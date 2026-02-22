import type { PrismaClient, Prisma } from '@prisma/client';
import {
  randomInt,
  pickOne,
  pickMany,
  randomDateBetween,
} from '../utils';
import type { ProductRecord } from './products';
import type { WarehouseRecord } from './warehouses';
import type { SeedUsersResult } from './users';

/** Ledger: (productId, warehouseId) -> current quantity. Updated as we create movements. */
type BalanceMap = Map<string, number>;

const BATCH_SIZE = 80;

function balanceKey(productId: string, warehouseId: string): string {
  return `${productId}:${warehouseId}`;
}

function getBalance(map: BalanceMap, productId: string, warehouseId: string): number {
  return map.get(balanceKey(productId, warehouseId)) ?? 0;
}

function addBalance(map: BalanceMap, productId: string, warehouseId: string, qty: number): void {
  const k = balanceKey(productId, warehouseId);
  map.set(k, (map.get(k) ?? 0) + qty);
}

function subtractBalance(map: BalanceMap, productId: string, warehouseId: string, qty: number): void {
  const k = balanceKey(productId, warehouseId);
  const current = map.get(k) ?? 0;
  map.set(k, Math.max(0, current - qty));
}

const ADJUSTMENT_REASONS = ['damage', 'recount', 'correction', 'opening_stock'];

export interface StockSeedContext {
  products: ProductRecord[];
  warehouses: WarehouseRecord[];
  users: SeedUsersResult;
  /** Optional supplier names for purchase notes (no Supplier table) */
  supplierNames?: string[];
  /** Optional customer names for sale notes (no Customer table) */
  customerNames?: string[];
  config: {
    purchases: number;
    purchaseItemsMin: number;
    purchaseItemsMax: number;
    sales: number;
    saleItemsMin: number;
    saleItemsMax: number;
    transfers: number;
    adjustments: number;
    daysBack: number;
  };
}

type MovementCreateData = Prisma.StockMovementUncheckedCreateInput;

export async function seedPurchases(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config, supplierNames } = ctx;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - config.daysBack);
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  const batch: MovementCreateData[] = [];

  for (let po = 0; po < config.purchases; po++) {
    const ref = `PO-${10000 + po}`;
    const warehouse = pickOne(warehouses);
    const createdBy = pickOne(userIds);
    const createdAt = randomDateBetween(start, end);
    const supplierNote =
      supplierNames && supplierNames.length > 0
        ? ` from ${pickOne(supplierNames)}`
        : '';
    const notes = `Purchase order ${ref}${supplierNote}`;
    const itemCount = randomInt(config.purchaseItemsMin, config.purchaseItemsMax);
    const chosenProducts = pickMany(products, itemCount);

    for (const product of chosenProducts) {
      const qty = randomInt(5, 80);
      addBalance(balanceMap, product.id, warehouse.id, qty);
      batch.push({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: 'IN',
        quantity: qty,
        referenceType: 'PURCHASE',
        referenceId: ref,
        referenceNumber: ref,
        notes,
        createdById: createdBy,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      chunk.map((data) => prisma.stockMovement.create({ data }))
    );
  }
}

export async function seedSales(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config, customerNames } = ctx;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - config.daysBack);
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  const batch: MovementCreateData[] = [];

  for (let so = 0; so < config.sales; so++) {
    const ref = `SO-${20000 + so}`;
    const warehouse = pickOne(warehouses);
    const createdBy = pickOne(userIds);
    const createdAt = randomDateBetween(start, end);
    const customerNote =
      customerNames && customerNames.length > 0
        ? ` to ${pickOne(customerNames)}`
        : '';
    const notes = `Sale order ${ref}${customerNote}`;
    const itemCount = randomInt(config.saleItemsMin, config.saleItemsMax);
    const chosenProducts = pickMany(products, itemCount);

    for (const product of chosenProducts) {
      const available = getBalance(balanceMap, product.id, warehouse.id);
      if (available <= 0) continue;
      const qty = Math.min(randomInt(1, 20), Math.floor(available));
      if (qty <= 0) continue;

      subtractBalance(balanceMap, product.id, warehouse.id, qty);
      batch.push({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: 'OUT',
        quantity: qty,
        referenceType: 'SALE',
        referenceId: ref,
        referenceNumber: ref,
        notes,
        createdById: createdBy,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      chunk.map((data) => prisma.stockMovement.create({ data }))
    );
  }
}

export async function seedTransfers(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config } = ctx;
  if (warehouses.length < 2) return;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - config.daysBack);
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  for (let t = 0; t < config.transfers; t++) {
    const [fromWh, toWh] = pickMany(warehouses, 2);
    if (fromWh.id === toWh.id) continue;
    const product = pickOne(products);
    const available = getBalance(balanceMap, product.id, fromWh.id);
    if (available <= 0) continue;
    const qty = Math.min(randomInt(1, 25), Math.floor(available));
    if (qty <= 0) continue;

    const ref = `TR-${30000 + t}`;
    const createdBy = pickOne(userIds);
    const createdAt = randomDateBetween(start, end);

    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId: product.id,
          warehouseId: fromWh.id,
          movementType: 'OUT',
          quantity: qty,
          referenceType: 'TRANSFER',
          referenceId: ref,
          referenceNumber: ref,
          notes: `Transfer to ${toWh.name}`,
          createdById: createdBy,
          createdAt,
          updatedAt: createdAt,
        },
      }),
      prisma.stockMovement.create({
        data: {
          productId: product.id,
          warehouseId: toWh.id,
          movementType: 'IN',
          quantity: qty,
          referenceType: 'TRANSFER',
          referenceId: ref,
          referenceNumber: ref,
          notes: `Transfer from ${fromWh.name}`,
          createdById: createdBy,
          createdAt,
          updatedAt: createdAt,
        },
      }),
    ]);
    subtractBalance(balanceMap, product.id, fromWh.id, qty);
    addBalance(balanceMap, product.id, toWh.id, qty);
  }
}

export async function seedAdjustments(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config } = ctx;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - config.daysBack);
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  const batch: MovementCreateData[] = [];

  for (let a = 0; a < config.adjustments; a++) {
    const product = pickOne(products);
    const warehouse = pickOne(warehouses);
    const reason = pickOne(ADJUSTMENT_REASONS);
    const createdBy = pickOne(userIds);
    const createdAt = randomDateBetween(start, end);
    const ref = `ADJ-${40000 + a}`;

    if (randomInt(0, 1) === 0) {
      const qty = randomInt(1, 30);
      addBalance(balanceMap, product.id, warehouse.id, qty);
      batch.push({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: 'IN',
        quantity: qty,
        referenceType: 'ADJUSTMENT',
        referenceId: ref,
        referenceNumber: ref,
        notes: `${reason}: adjustment`,
        createdById: createdBy,
        createdAt,
        updatedAt: createdAt,
      });
    } else {
      const available = getBalance(balanceMap, product.id, warehouse.id);
      if (available <= 0) continue;
      const qty = Math.min(randomInt(1, 15), Math.floor(available));
      if (qty <= 0) continue;
      subtractBalance(balanceMap, product.id, warehouse.id, qty);
      batch.push({
        productId: product.id,
        warehouseId: warehouse.id,
        movementType: 'OUT',
        quantity: qty,
        referenceType: 'ADJUSTMENT',
        referenceId: ref,
        referenceNumber: ref,
        notes: `${reason}: adjustment`,
        createdById: createdBy,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      chunk.map((data) => prisma.stockMovement.create({ data }))
    );
  }
}

/**
 * Recompute StockBalance from StockMovement ledger (source of truth).
 * Sum IN/TRANSFER-in minus OUT/TRANSFER-out per product+warehouse.
 */
export async function syncBalancesFromLedger(prisma: PrismaClient): Promise<void> {
  const movements = await prisma.stockMovement.findMany({
    select: { productId: true, warehouseId: true, movementType: true, quantity: true },
  });

  const byKey = new Map<string, number>();
  for (const m of movements) {
    const k = balanceKey(m.productId, m.warehouseId);
    const q = Number(m.quantity);
    const current = byKey.get(k) ?? 0;
    if (m.movementType === 'IN') {
      byKey.set(k, current + q);
    } else {
      byKey.set(k, current - q);
    }
  }

  const now = new Date();
  for (const [key, quantity] of byKey) {
    const [productId, warehouseId] = key.split(':');
    if (!productId || !warehouseId) continue;
    const q = Math.max(0, Math.round(quantity * 100) / 100);
    await prisma.stockBalance.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      update: {
        quantity: q,
        available: q,
        reserved: 0,
        lastUpdated: now,
        updatedAt: now,
      },
      create: {
        productId,
        warehouseId,
        quantity: q,
        reserved: 0,
        available: q,
        lastUpdated: now,
        updatedAt: now,
      },
    });
  }
}
