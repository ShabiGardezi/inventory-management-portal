/**
 * Phase 0: Stock adjustments via StockService.adjustStock (IN/OUT).
 */

import type { PrismaClient } from '@prisma/client';
import { StockService } from '@/server/services/stock.service';
import { initSeed, randomInt, pickOne } from '@/prisma/seed/utils';
import type { ProductRecord } from './products';
import type { WarehouseRecord } from './warehouses';
import type { SeedRolesAndUsersResult } from './rolesAndUsers';

const balanceKey = (productId: string, warehouseId: string): string =>
  `${productId}:${warehouseId}`;

const REASONS = ['damage', 'recount', 'correction', 'opening_stock'] as const;

export async function createAdjustments(
  prisma: PrismaClient,
  options: {
    products: ProductRecord[];
    warehouses: WarehouseRecord[];
    users: SeedRolesAndUsersResult;
    balanceMap: Map<string, number>;
    count: number;
    seed: number;
  }
): Promise<void> {
  initSeed(options.seed + 3);
  const stockService = new StockService(prisma);
  const userIds = [
    options.users.adminUserId,
    options.users.managerUserId,
    ...Array.from(options.users.userIdByEmail.values()),
  ].filter(Boolean);
  if (userIds.length === 0) return;

  for (let a = 0; a < options.count; a++) {
    const product = pickOne(options.products);
    const warehouse = pickOne(options.warehouses);
    const reason = pickOne(REASONS);
    const createdBy = pickOne(userIds);

    if (randomInt(0, 1) === 0) {
      const qty = randomInt(1, 25);
      await stockService.adjustStock({
        productId: product.id,
        warehouseId: warehouse.id,
        method: 'increase',
        quantity: qty,
        reason,
        notes: 'Seed adjustment',
        createdById: createdBy,
      });
      const k = balanceKey(product.id, warehouse.id);
      options.balanceMap.set(k, (options.balanceMap.get(k) ?? 0) + qty);
    } else {
      const available = options.balanceMap.get(balanceKey(product.id, warehouse.id)) ?? 0;
      if (available <= 0) continue;
      const qty = Math.min(randomInt(1, 10), Math.floor(available));
      if (qty <= 0) continue;
      await stockService.adjustStock({
        productId: product.id,
        warehouseId: warehouse.id,
        method: 'decrease',
        quantity: qty,
        reason,
        notes: 'Seed adjustment',
        createdById: createdBy,
      });
      const k = balanceKey(product.id, warehouse.id);
      options.balanceMap.set(k, Math.max(0, (options.balanceMap.get(k) ?? 0) - qty));
    }
  }
}
