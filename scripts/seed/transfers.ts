/**
 * Phase 0: Stock transfers via StockService.transferStock (two movements, same referenceId).
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

export async function createTransfers(
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
  if (options.warehouses.length < 2 || options.products.length === 0) return;
  initSeed(options.seed + 2);
  const stockService = new StockService(prisma);
  const userIds = [
    options.users.adminUserId,
    options.users.managerUserId,
    ...Array.from(options.users.userIdByEmail.values()),
  ].filter(Boolean);
  if (userIds.length === 0) return;

  for (let t = 0; t < options.count; t++) {
    const pair = pickMany(options.warehouses, 2);
    const fromWh = pair[0];
    const toWh = pair[1];
    if (!fromWh || !toWh || fromWh.id === toWh.id) continue;
    const product = pickOne(options.products);
    if (!product) continue;
    const available = getBalance(options.balanceMap, product.id, fromWh.id);
    if (available <= 0) continue;
    const qty = Math.min(randomInt(1, 20), Math.floor(available));
    if (qty <= 0) continue;

    let batchId: string | undefined;
    let serialNumbers: string[] | undefined;
    if (product.trackBatches) {
      const batch = await prisma.batch.findFirst({
        where: { productId: product.id },
        select: { id: true },
      });
      batchId = batch?.id;
      if (!batchId) continue;
    }
    if (product.trackSerials) {
      const serials = await prisma.productSerial.findMany({
        where: {
          productId: product.id,
          warehouseId: fromWh.id,
          status: 'IN_STOCK',
        },
        take: qty,
        select: { serialNumber: true },
      });
      if (serials.length < qty) continue;
      serialNumbers = serials.map((s) => s.serialNumber);
    }

    const ref = `TR-${30000 + t}`;
    const createdBy = pickOne(userIds);

    await stockService.transferStock({
      productId: product.id,
      fromWarehouseId: fromWh.id,
      toWarehouseId: toWh.id,
      quantity: qty,
      referenceNumber: ref,
      notes: `Transfer to ${toWh.name}`,
      createdById: createdBy,
      batchId,
      serialNumbers,
    });

    const kFrom = balanceKey(product.id, fromWh.id);
    const kTo = balanceKey(product.id, toWh.id);
    const curFrom = options.balanceMap.get(kFrom) ?? 0;
    const curTo = options.balanceMap.get(kTo) ?? 0;
    options.balanceMap.set(kFrom, Math.max(0, curFrom - qty));
    options.balanceMap.set(kTo, curTo + qty);
  }
}
