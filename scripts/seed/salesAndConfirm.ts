/**
 * Phase 2: Sales + confirm via StockService.confirmSale (OUT movements, balances).
 * Uses balanceMap to avoid selling more than available. For batch/serial products picks available batch/serials.
 */

import type { PrismaClient } from '@prisma/client';
import { StockService } from '@/server/services/stock.service';
import { initSeed, randomInt, pickOne, pickMany } from '@/prisma/seed/utils';
import type { ProductRecord } from './products';
import type { WarehouseRecord } from './warehouses';
import type { SeedRolesAndUsersResult } from './rolesAndUsers';

const balanceKey = (productId: string, warehouseId: string): string =>
  `${productId}:${warehouseId}`;

function getBalance(map: Map<string, number>, productId: string, warehouseId: string): number {
  return map.get(balanceKey(productId, warehouseId)) ?? 0;
}

function subtractBalance(
  map: Map<string, number>,
  productId: string,
  warehouseId: string,
  qty: number
): void {
  const k = balanceKey(productId, warehouseId);
  const cur = map.get(k) ?? 0;
  map.set(k, Math.max(0, cur - qty));
}

export async function createSalesAndConfirm(
  prisma: PrismaClient,
  options: {
    products: ProductRecord[];
    warehouses: WarehouseRecord[];
    users: SeedRolesAndUsersResult;
    balanceMap: Map<string, number>;
    count: number;
    itemsMin: number;
    itemsMax: number;
    seed: number;
  }
): Promise<void> {
  initSeed(options.seed + 1);
  const stockService = new StockService(prisma);
  const userIds = [
    options.users.adminUserId,
    options.users.managerUserId,
    ...Array.from(options.users.userIdByEmail.values()),
  ].filter(Boolean);
  if (userIds.length === 0) return;

  for (let so = 0; so < options.count; so++) {
    const ref = `SO-${20000 + so}`;
    const warehouse = pickOne(options.warehouses);
    const createdBy = pickOne(userIds);
    const itemCount = randomInt(options.itemsMin, options.itemsMax);
    const chosen = pickMany(options.products, itemCount);

    for (const product of chosen) {
      let available = getBalance(options.balanceMap, product.id, warehouse.id);
      const dbBalance = await prisma.stockBalance.aggregate({
        where: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
        _sum: { quantity: true },
      });
      const dbQty = Number(dbBalance._sum.quantity ?? 0);
      if (dbQty <= 0) continue;
      available = Math.min(available, dbQty);
      if (available <= 0) continue;
      let qty = Math.min(randomInt(1, 15), Math.floor(available));
      if (qty <= 0) continue;

      let batchId: string | undefined;
      let serialNumbers: string[] | undefined;

      if (product.trackBatches) {
        const balanceWithBatch = await prisma.stockBalance.findFirst({
          where: {
            productId: product.id,
            warehouseId: warehouse.id,
            batchId: { not: null },
            quantity: { gt: 0 },
          },
          select: { batchId: true, quantity: true },
        });
        if (!balanceWithBatch?.batchId) continue;
        const batchQty = Number(balanceWithBatch.quantity);
        if (batchQty < qty) qty = Math.floor(batchQty);
        if (qty <= 0) continue;
        batchId = balanceWithBatch.batchId;
      }
      if (product.trackSerials) {
        const serials = await prisma.productSerial.findMany({
          where: {
            productId: product.id,
            warehouseId: warehouse.id,
            status: 'IN_STOCK',
          },
          take: qty,
          select: { serialNumber: true },
        });
        if (serials.length < qty) continue;
        serialNumbers = serials.map((s) => s.serialNumber);
      }

      await stockService.confirmSale({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: qty,
        referenceId: ref,
        referenceNumber: ref,
        notes: `Sale ${ref}`,
        createdById: createdBy,
        batchId,
        serialNumbers,
      });

      subtractBalance(options.balanceMap, product.id, warehouse.id, qty);
    }
  }
}
