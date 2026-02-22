import type { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const DEFAULT_LOOKBACK_DAYS = 30;
const MIN_LOOKBACK_DAYS = 1;
const MAX_LOOKBACK_DAYS = 365;

export interface ComputeMetricsOptions {
  /** Sales lookback period in days (default 30). */
  lookbackDays?: number;
  /** Skip recompute if lastComputedAt is within this many minutes (optional optimization). */
  skipIfRecentMinutes?: number;
}

export interface RecomputeAllOptions {
  lookbackDays?: number;
  /** Only recompute for (productId, warehouseId) pairs that have a ReorderPolicy. */
  onlyWithPolicy?: boolean;
  /** Max concurrent computations (default 10). */
  concurrency?: number;
}

/**
 * Smart reorder calculation engine. Computes metrics from indexed sales and stock data;
 * results are stored in InventoryMetrics so the dashboard does not recalculate on every render.
 */
export class InventoryMetricsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Compute and store metrics for one product/warehouse.
   * Uses indexed queries: sales = OUT + SALE in date range; current stock = sum of balances.
   */
  async computeMetricsForProductWarehouse(
    productId: string,
    warehouseId: string,
    options: ComputeMetricsOptions = {}
  ): Promise<{
    avgDailySales: Decimal;
    daysOfCover: Decimal;
    predictedStockoutDate: Date | null;
    suggestedReorderQty: Decimal;
    lastComputedAt: Date;
  } | null> {
    const lookbackDays = Math.min(
      MAX_LOOKBACK_DAYS,
      Math.max(MIN_LOOKBACK_DAYS, options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS)
    );
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - lookbackDays);
    start.setHours(0, 0, 0, 0);

    if (options.skipIfRecentMinutes != null && options.skipIfRecentMinutes > 0) {
      const existing = await this.prisma.inventoryMetrics.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
        select: { lastComputedAt: true },
      });
      if (existing) {
        const cutoff = new Date(now.getTime() - options.skipIfRecentMinutes * 60 * 1000);
        if (existing.lastComputedAt >= cutoff) {
          return null;
        }
      }
    }

    const [salesAgg, balancesSum, reorderPolicy] = await Promise.all([
      this.prisma.stockMovement.aggregate({
        where: {
          productId,
          warehouseId,
          movementType: 'OUT',
          referenceType: 'SALE',
          createdAt: { gte: start, lte: now },
        },
        _sum: { quantity: true },
      }),
      this.prisma.stockBalance.aggregate({
        where: { productId, warehouseId },
        _sum: { quantity: true },
      }),
      this.prisma.reorderPolicy.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      }),
    ]);

    const totalSoldQty = salesAgg._sum.quantity ?? new Decimal(0);
    const days = lookbackDays;
    const avgDailySales = days > 0 ? new Decimal(totalSoldQty).div(days) : new Decimal(0);
    const currentStock = balancesSum._sum.quantity ?? new Decimal(0);

    let daysOfCover = new Decimal(0);
    let predictedStockoutDate: Date | null = null;
    if (avgDailySales.gt(0)) {
      daysOfCover = new Decimal(currentStock).div(avgDailySales);
      if (daysOfCover.gt(0)) {
        predictedStockoutDate = new Date(now.getTime() + daysOfCover.toNumber() * 24 * 60 * 60 * 1000);
      }
    }

    let suggestedReorderQty = new Decimal(0);
    if (reorderPolicy) {
      const leadDemand = new Decimal(reorderPolicy.leadTimeDays).mul(avgDailySales);
      const safety = new Decimal(reorderPolicy.safetyStock);
      const target = leadDemand.plus(safety);
      suggestedReorderQty = target.minus(currentStock);
      if (suggestedReorderQty.lt(0)) suggestedReorderQty = new Decimal(0);
      if (reorderPolicy.maxStock != null) {
        const maxQty = new Decimal(reorderPolicy.maxStock);
        if (suggestedReorderQty.gt(maxQty)) suggestedReorderQty = maxQty;
      }
    }

    const lastComputedAt = new Date();
    await this.prisma.inventoryMetrics.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: {
        productId,
        warehouseId,
        avgDailySales,
        daysOfCover,
        predictedStockoutDate,
        suggestedReorderQty,
        lastComputedAt,
      },
      update: {
        avgDailySales,
        daysOfCover,
        predictedStockoutDate,
        suggestedReorderQty,
        lastComputedAt,
      },
    });

    return {
      avgDailySales,
      daysOfCover,
      predictedStockoutDate,
      suggestedReorderQty,
      lastComputedAt,
    };
  }

  /**
   * Recompute metrics for a single product/warehouse (e.g. after receive, sale, adjust).
   * Call this from API routes after stock-changing operations.
   */
  async recomputeForProductWarehouse(
    productId: string,
    warehouseId: string,
    options: ComputeMetricsOptions = {}
  ): Promise<void> {
    await this.computeMetricsForProductWarehouse(productId, warehouseId, {
      ...options,
      skipIfRecentMinutes: undefined,
    });
  }

  /**
   * Recompute all metrics (manual "Recalculate" or scheduled job).
   * Uses parallel queries; only processes pairs that have a reorder policy or existing metrics if onlyWithPolicy is false.
   */
  async recomputeAllMetrics(options: RecomputeAllOptions = {}): Promise<{ computed: number }> {
    const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const concurrency = Math.max(1, options.concurrency ?? 10);

    let pairs: Array<{ productId: string; warehouseId: string }>;

    if (options.onlyWithPolicy) {
      const policies = await this.prisma.reorderPolicy.findMany({
        select: { productId: true, warehouseId: true },
      });
      pairs = policies.map((p) => ({ productId: p.productId, warehouseId: p.warehouseId }));
    } else {
      const distinct = await this.prisma.stockBalance.findMany({
        select: { productId: true, warehouseId: true },
        distinct: ['productId', 'warehouseId'],
      });
      const policyPairs = await this.prisma.reorderPolicy.findMany({
        select: { productId: true, warehouseId: true },
      });
      const set = new Map<string, { productId: string; warehouseId: string }>();
      for (const d of distinct) set.set(`${d.productId}:${d.warehouseId}`, d);
      for (const p of policyPairs) set.set(`${p.productId}:${p.warehouseId}`, p);
      pairs = Array.from(set.values());
    }

    let computed = 0;
    for (let i = 0; i < pairs.length; i += concurrency) {
      const chunk = pairs.slice(i, i + concurrency);
      const results = await Promise.all(
        chunk.map(({ productId, warehouseId }) =>
          this.computeMetricsForProductWarehouse(productId, warehouseId, {
            lookbackDays,
            skipIfRecentMinutes: undefined,
          })
        )
      );
      computed += results.filter((r) => r != null).length;
    }

    return { computed };
  }
}
