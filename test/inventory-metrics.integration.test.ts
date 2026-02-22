import { describe, it, expect, beforeEach } from 'vitest';
import { createTestPrisma, resetTestDb } from './helpers/db';
import {
  createUserWithPermissions,
  createWarehouse,
  createProduct,
  seedStock,
  ensureSettings,
} from './helpers/factories';
import { StockService } from '@/server/services/stock.service';
import { InventoryMetricsService } from '@/server/services/inventoryMetricsService';

const prisma = createTestPrisma();

beforeEach(async () => {
  await resetTestDb(prisma);
  await ensureSettings(prisma, false);
});

describe('InventoryMetricsService integration', () => {
  it('computeMetricsForProductWarehouse: seed sales history, compute metrics, validate avgDailySales, suggestedReorderQty, predictedStockoutDate', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);

    // 1) Seed stock: 100 units
    await seedStock(prisma, {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 100,
      userId: user.id,
      referenceNumber: 'PO-SEED',
    });

    // 2) Seed sales history: confirm 90 units sold over "last 30 days" (all OUT+SALE in range)
    const stockService = new StockService(prisma);
    const soldTotal = 90;
    const soldPerSale = 10;
    for (let i = 0; i < soldTotal / soldPerSale; i++) {
      await stockService.confirmSale({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: soldPerSale,
        referenceNumber: `SO-${i + 1}`,
        referenceId: `so-${i + 1}`,
        createdById: user.id,
      });
    }
    // Current stock = 100 - 90 = 10

    const lookbackDays = 30;
    const expectedAvgDailySales = soldTotal / lookbackDays; // 3
    const expectedCurrentStock = 10;
    const leadTimeDays = 7;
    const safetyStock = 10;
    const expectedSuggestedReorderQty = leadTimeDays * expectedAvgDailySales + safetyStock - expectedCurrentStock; // 7*3 + 10 - 10 = 21

    // 3) Create reorder policy
    await prisma.reorderPolicy.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        minStock: 5,
        leadTimeDays,
        safetyStock,
      },
    });

    // 4) Compute metrics
    const metricsService = new InventoryMetricsService(prisma);
    const result = await metricsService.computeMetricsForProductWarehouse(product.id, warehouse.id, {
      lookbackDays,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    const avgDailySalesNum = Number(result.avgDailySales);
    const suggestedReorderQtyNum = Number(result.suggestedReorderQty);
    const daysOfCoverNum = Number(result.daysOfCover);

    expect(avgDailySalesNum).toBeCloseTo(expectedAvgDailySales, 2);
    expect(suggestedReorderQtyNum).toBeCloseTo(expectedSuggestedReorderQty, 0);
    expect(result.predictedStockoutDate).not.toBeNull();
    expect(daysOfCoverNum).toBeGreaterThan(0);
    expect(daysOfCoverNum).toBeCloseTo(expectedCurrentStock / expectedAvgDailySales, 1);

    const nowMs = Date.now();
    const stockoutMs = result.predictedStockoutDate!.getTime();
    const expectedDaysToStockout = expectedCurrentStock / expectedAvgDailySales;
    const expectedStockoutMs = nowMs + expectedDaysToStockout * 24 * 60 * 60 * 1000;
    expect(Math.abs(stockoutMs - expectedStockoutMs)).toBeLessThan(2 * 60 * 60 * 1000);

    const stored = await prisma.inventoryMetrics.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    });
    expect(stored).not.toBeNull();
    expect(Number(stored!.avgDailySales)).toBeCloseTo(expectedAvgDailySales, 2);
    expect(Number(stored!.suggestedReorderQty)).toBeCloseTo(expectedSuggestedReorderQty, 0);
    expect(stored!.predictedStockoutDate).not.toBeNull();
  });

  it('recomputeAllMetrics: computes for pairs with policy or balance', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await seedStock(prisma, {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 50,
      userId: user.id,
    });
    await prisma.reorderPolicy.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        minStock: 5,
        leadTimeDays: 5,
        safetyStock: 5,
      },
    });

    const metricsService = new InventoryMetricsService(prisma);
    const { computed } = await metricsService.recomputeAllMetrics({
      lookbackDays: 30,
      onlyWithPolicy: true,
      concurrency: 5,
    });

    expect(computed).toBeGreaterThanOrEqual(1);
    const stored = await prisma.inventoryMetrics.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    });
    expect(stored).not.toBeNull();
    expect(Number(stored!.avgDailySales)).toBe(0);
    expect(Number(stored!.suggestedReorderQty)).toBeGreaterThanOrEqual(0);
  });
});
