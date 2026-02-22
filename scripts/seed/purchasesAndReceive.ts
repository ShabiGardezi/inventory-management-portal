/**
 * Phase 2: Purchases + receive via StockService.receivePurchase (IN movements, balances, serials when applicable).
 */

import type { PrismaClient } from '@prisma/client';
import { StockService } from '@/server/services/stock.service';
import { initSeed, randomInt, pickOne, pickMany } from '@/prisma/seed/utils';
import type { ProductRecord } from './products';
import type { WarehouseRecord } from './warehouses';
import type { SeedRolesAndUsersResult } from './rolesAndUsers';

const balanceKey = (productId: string, warehouseId: string): string =>
  `${productId}:${warehouseId}`;

export async function createPurchasesAndReceive(
  prisma: PrismaClient,
  options: {
    products: ProductRecord[];
    warehouses: WarehouseRecord[];
    users: SeedRolesAndUsersResult;
    count: number;
    itemsMin: number;
    itemsMax: number;
    daysBack: number;
    seed: number;
  }
): Promise<Map<string, number>> {
  initSeed(options.seed);
  const balanceMap = new Map<string, number>();
  const stockService = new StockService(prisma);
  const userIds = [
    options.users.adminUserId,
    options.users.managerUserId,
    ...Array.from(options.users.userIdByEmail.values()),
  ].filter(Boolean);
  if (userIds.length === 0) return balanceMap;

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - options.daysBack);

  for (let po = 0; po < options.count; po++) {
    const ref = `PO-${10000 + po}`;
    const warehouse = pickOne(options.warehouses);
    const createdBy = pickOne(userIds);
    const itemCount = randomInt(options.itemsMin, options.itemsMax);
    const chosen = pickMany(options.products, itemCount);

    for (const product of chosen) {
      const qty = randomInt(2, 40);
      const batchInput =
        product.trackBatches
          ? {
              batchNumber: `BATCH-${ref}-${product.sku}-${po}`,
              mfgDate: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
              expiryDate: new Date(end.getTime() + 180 * 24 * 60 * 60 * 1000),
            }
          : undefined;
      const serialNumbers = product.trackSerials
        ? Array.from({ length: qty }, (_, i) => `SN-${product.sku}-${po}-${i}`)
        : undefined;

      await stockService.receivePurchase({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: qty,
        referenceId: ref,
        referenceNumber: ref,
        notes: `Purchase ${ref}`,
        createdById: createdBy,
        batchInput,
        serialNumbers,
      });

      const k = balanceKey(product.id, warehouse.id);
      balanceMap.set(k, (balanceMap.get(k) ?? 0) + qty);
    }
  }

  return balanceMap;
}
