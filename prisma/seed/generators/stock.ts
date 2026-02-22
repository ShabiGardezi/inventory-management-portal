import type { PrismaClient } from '@prisma/client';
import {
  randomInt,
  pickOne,
  pickMany,
} from '../utils';
import type { ProductRecord } from './products';
import type { WarehouseRecord } from './warehouses';
import type { SeedUsersResult } from './users';
import { StockService } from '@/server/services/stock.service';

/** In-memory ledger for seed ordering: (productId, warehouseId) -> quantity. Updated as we call StockService. */
type BalanceMap = Map<string, number>;

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
  supplierNames?: string[];
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

/**
 * Seed purchase movements via StockService (IN + balance). Keeps balanceMap in sync for later sales/transfers.
 */
export async function seedPurchases(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config, supplierNames } = ctx;
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  const stockService = new StockService(prisma);

  for (let po = 0; po < config.purchases; po++) {
    const ref = `PO-${10000 + po}`;
    const warehouse = pickOne(warehouses);
    const createdBy = pickOne(userIds);
    const supplierNote =
      supplierNames && supplierNames.length > 0
        ? ` from ${pickOne(supplierNames)}`
        : '';
    const notes = `Purchase order ${ref}${supplierNote}`;
    const itemCount = randomInt(config.purchaseItemsMin, config.purchaseItemsMax);
    const chosenProducts = pickMany(products, itemCount);

    for (const product of chosenProducts) {
      const qty = randomInt(5, 80);
      await stockService.receivePurchase({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: qty,
        referenceId: ref,
        referenceNumber: ref,
        notes,
        createdById: createdBy,
      });
      addBalance(balanceMap, product.id, warehouse.id, qty);
    }
  }
}

/**
 * Seed sales via StockService (OUT + balance). Uses balanceMap to cap qty so we don't go negative.
 */
export async function seedSales(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config, customerNames } = ctx;
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  const stockService = new StockService(prisma);

  for (let so = 0; so < config.sales; so++) {
    const ref = `SO-${20000 + so}`;
    const warehouse = pickOne(warehouses);
    const createdBy = pickOne(userIds);
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

      await stockService.confirmSale({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: qty,
        referenceId: ref,
        referenceNumber: ref,
        notes,
        createdById: createdBy,
      });
      subtractBalance(balanceMap, product.id, warehouse.id, qty);
    }
  }
}

/**
 * Seed transfers via StockService (two movements with same referenceId + both balances in one transaction).
 */
export async function seedTransfers(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config } = ctx;
  if (warehouses.length < 2) return;
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  const stockService = new StockService(prisma);

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

    await stockService.transferStock({
      productId: product.id,
      fromWarehouseId: fromWh.id,
      toWarehouseId: toWh.id,
      quantity: qty,
      referenceNumber: ref,
      notes: `Transfer to ${toWh.name}`,
      createdById: createdBy,
    });
    subtractBalance(balanceMap, product.id, fromWh.id, qty);
    addBalance(balanceMap, product.id, toWh.id, qty);
  }
}

/**
 * Seed adjustments via StockService (IN/OUT + balance).
 */
export async function seedAdjustments(
  prisma: PrismaClient,
  ctx: StockSeedContext,
  balanceMap: BalanceMap
): Promise<void> {
  const { products, warehouses, users, config } = ctx;
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return;

  const stockService = new StockService(prisma);

  for (let a = 0; a < config.adjustments; a++) {
    const product = pickOne(products);
    const warehouse = pickOne(warehouses);
    const reason = pickOne(ADJUSTMENT_REASONS);
    const createdBy = pickOne(userIds);
    const ref = `ADJ-${40000 + a}`;

    if (randomInt(0, 1) === 0) {
      const qty = randomInt(1, 30);
      await stockService.adjustStock({
        productId: product.id,
        warehouseId: warehouse.id,
        method: 'increase',
        quantity: qty,
        reason,
        notes: 'adjustment',
        createdById: createdBy,
      });
      addBalance(balanceMap, product.id, warehouse.id, qty);
    } else {
      const available = getBalance(balanceMap, product.id, warehouse.id);
      if (available <= 0) continue;
      const qty = Math.min(randomInt(1, 15), Math.floor(available));
      if (qty <= 0) continue;
      await stockService.adjustStock({
        productId: product.id,
        warehouseId: warehouse.id,
        method: 'decrease',
        quantity: qty,
        reason,
        notes: 'adjustment',
        createdById: createdBy,
      });
      subtractBalance(balanceMap, product.id, warehouse.id, qty);
    }
  }
}
