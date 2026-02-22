/**
 * Phase 3: Reorder policies and InventoryMetricsService.recomputeAllMetrics().
 */

import type { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryMetricsService } from '@/server/services/inventoryMetricsService';
import { initSeed, randomInt, pickOne, pickMany } from '@/prisma/seed/utils';
import type { ProductRecord } from './products';
import type { WarehouseRecord } from './warehouses';

export async function createReorderPoliciesAndMetrics(
  prisma: PrismaClient,
  options: {
    products: ProductRecord[];
    warehouses: WarehouseRecord[];
    countPolicyPerProduct: number;
    seed: number;
  }
): Promise<{ policiesCreated: number; metricsComputed: number }> {
  initSeed(options.seed + 4);
  const metricsService = new InventoryMetricsService(prisma);
  let policiesCreated = 0;

  const productSample = pickMany(
    options.products,
    Math.min(options.products.length, 50)
  );
  for (const product of productSample) {
    const whs = pickMany(options.warehouses, Math.min(options.countPolicyPerProduct, options.warehouses.length));
    for (const wh of whs) {
      const existing = await prisma.reorderPolicy.findUnique({
        where: {
          productId_warehouseId: { productId: product.id, warehouseId: wh.id },
        },
      });
      if (existing) continue;
      const minStock = new Decimal(randomInt(5, 30));
      const maxStock = new Decimal(randomInt(40, 200));
      const leadTimeDays = randomInt(3, 14);
      const safetyStock = new Decimal(randomInt(2, 15));
      await prisma.reorderPolicy.create({
        data: {
          productId: product.id,
          warehouseId: wh.id,
          minStock,
          maxStock,
          leadTimeDays,
          safetyStock,
        },
      });
      policiesCreated++;
    }
  }

  const { computed } = await metricsService.recomputeAllMetrics({
    lookbackDays: 30,
    onlyWithPolicy: false,
    concurrency: 1,
  });

  return { policiesCreated, metricsComputed: computed };
}
