import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const LOW_STOCK_THRESHOLD = 10;

export interface DashboardRepoDeps {
  prisma?: PrismaClient;
}

function getPrisma(deps?: DashboardRepoDeps) {
  return deps?.prisma ?? prisma;
}

/**
 * Total count of active products
 */
export async function getTotalProducts(deps?: DashboardRepoDeps): Promise<number> {
  return getPrisma(deps).product.count({ where: { isActive: true } });
}

/**
 * Total count of active warehouses
 */
export async function getTotalWarehouses(deps?: DashboardRepoDeps): Promise<number> {
  return getPrisma(deps).warehouse.count({ where: { isActive: true } });
}

/**
 * Total stock value: sum over all balances of (quantity * product price)
 */
export async function getTotalStockValue(deps?: DashboardRepoDeps): Promise<number> {
  const balances = await getPrisma(deps).stockBalance.findMany({
    include: { product: { select: { price: true } } },
  });
  let total = 0;
  for (const b of balances) {
    const qty = Number(b.quantity);
    const price = b.product.price != null ? Number(b.product.price) : 0;
    total += qty * price;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Count of products where total available across warehouses < LOW_STOCK_THRESHOLD
 */
export async function getLowStockCount(deps?: DashboardRepoDeps): Promise<number> {
  const products = await getPrisma(deps).product.findMany({
    where: { isActive: true },
    include: { stockBalances: { select: { available: true } } },
  });
  return products.filter((p) => {
    const total = p.stockBalances.reduce((s, b) => s + Number(b.available), 0);
    return total < LOW_STOCK_THRESHOLD && total >= 0;
  }).length;
}

/**
 * Today's OUT movements total quantity (sales count)
 */
export async function getTodaySalesQuantity(deps?: DashboardRepoDeps): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const result = await getPrisma(deps).stockMovement.aggregate({
    where: {
      movementType: 'OUT',
      createdAt: { gte: start },
    },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity ?? 0);
}

/**
 * Today's OUT movements total value (quantity * price per movement)
 */
export async function getTodaySalesTotal(deps?: DashboardRepoDeps): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const movements = await getPrisma(deps).stockMovement.findMany({
    where: { movementType: 'OUT', createdAt: { gte: start } },
    include: { product: { select: { price: true } } },
  });
  let total = 0;
  for (const m of movements) {
    const price = m.product.price != null ? Number(m.product.price) : 0;
    total += Number(m.quantity) * price;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Today's IN movements total quantity
 */
export async function getTodayPurchasesQuantity(deps?: DashboardRepoDeps): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const result = await getPrisma(deps).stockMovement.aggregate({
    where: {
      movementType: 'IN',
      createdAt: { gte: start },
    },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity ?? 0);
}

/**
 * Today's IN movements total value
 */
export async function getTodayPurchasesTotal(deps?: DashboardRepoDeps): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const movements = await getPrisma(deps).stockMovement.findMany({
    where: { movementType: 'IN', createdAt: { gte: start } },
    include: { product: { select: { price: true } } },
  });
  let total = 0;
  for (const m of movements) {
    const price = m.product.price != null ? Number(m.product.price) : 0;
    total += Number(m.quantity) * price;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Count of TRANSFER movements in the last 7 days
 */
export async function getTransfersThisWeek(deps?: DashboardRepoDeps): Promise<number> {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return getPrisma(deps).stockMovement.count({
    where: { movementType: 'TRANSFER', createdAt: { gte: start } },
  });
}

/**
 * Count of movements created by userId in the last 14 days
 */
export async function getMyRecentMovementsCount(
  userId: string,
  deps?: DashboardRepoDeps
): Promise<number> {
  const start = new Date();
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);
  return getPrisma(deps).stockMovement.count({
    where: { createdById: userId, createdAt: { gte: start } },
  });
}

function getDaysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

/**
 * Daily IN/OUT counts for the last N days (for charts)
 */
export async function getMovementTrend(
  days: number,
  deps?: DashboardRepoDeps
): Promise<{ date: string; in: number; out: number }[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return getMovementTrendByRange(start, end, deps);
}

/**
 * Daily IN/OUT counts for a custom date range (for charts)
 */
export async function getMovementTrendByRange(
  startDate: Date,
  endDate: Date,
  deps?: DashboardRepoDeps
): Promise<{ date: string; in: number; out: number }[]> {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const days = getDaysBetween(start, end);

  const movements = await getPrisma(deps).stockMovement.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { movementType: true, quantity: true, createdAt: true },
  });

  const byDate: Record<string, { in: number; out: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = { in: 0, out: 0 };
  }

  for (const m of movements) {
    const key = new Date(m.createdAt).toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = { in: 0, out: 0 };
    const q = Number(m.quantity);
    if (m.movementType === 'IN') byDate[key].in += q;
    else if (m.movementType === 'OUT') byDate[key].out += q;
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, in: v.in, out: v.out }));
}

/**
 * Sales (OUT) vs Purchases (IN) value by day for last N days
 */
export async function getSalesVsPurchasesTrend(
  days: number,
  deps?: DashboardRepoDeps
): Promise<{ date: string; sales: number; purchases: number }[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return getSalesVsPurchasesTrendByRange(start, end, deps);
}

/**
 * Sales vs Purchases value by day for a custom date range
 */
export async function getSalesVsPurchasesTrendByRange(
  startDate: Date,
  endDate: Date,
  deps?: DashboardRepoDeps
): Promise<{ date: string; sales: number; purchases: number }[]> {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const days = getDaysBetween(start, end);

  const movements = await getPrisma(deps).stockMovement.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      movementType: { in: ['IN', 'OUT'] },
    },
    include: { product: { select: { price: true } } },
  });

  const byDate: Record<string, { sales: number; purchases: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = { sales: 0, purchases: 0 };
  }

  for (const m of movements) {
    const key = new Date(m.createdAt).toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = { sales: 0, purchases: 0 };
    const price = m.product.price != null ? Number(m.product.price) : 0;
    const value = Number(m.quantity) * price;
    if (m.movementType === 'OUT') byDate[key].sales += value;
    else byDate[key].purchases += value;
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      sales: Math.round(v.sales * 100) / 100,
      purchases: Math.round(v.purchases * 100) / 100,
    }));
}

/**
 * Low stock count by category (for chart)
 */
export async function getLowStockByCategory(
  deps?: DashboardRepoDeps
): Promise<{ category: string; count: number }[]> {
  const products = await getPrisma(deps).product.findMany({
    where: { isActive: true },
    select: {
      category: true,
      stockBalances: { select: { available: true } },
    },
  });

  const categorySums: Record<string, number> = {};
  for (const p of products) {
    const total = p.stockBalances.reduce((s, b) => s + Number(b.available), 0);
    if (total < LOW_STOCK_THRESHOLD && total >= 0) {
      const cat = p.category ?? 'Uncategorized';
      categorySums[cat] = (categorySums[cat] ?? 0) + 1;
    }
  }
  return Object.entries(categorySums).map(([category, count]) => ({ category, count }));
}

/**
 * Stock on hand by category (total available quantity per category)
 */
export async function getStockByCategory(
  deps?: DashboardRepoDeps
): Promise<{ category: string; quantity: number }[]> {
  const products = await getPrisma(deps).product.findMany({
    where: { isActive: true },
    select: {
      category: true,
      stockBalances: { select: { available: true } },
    },
  });

  const categorySums: Record<string, number> = {};
  for (const p of products) {
    const total = p.stockBalances.reduce((s, b) => s + Number(b.available), 0);
    const cat = p.category ?? 'Uncategorized';
    categorySums[cat] = (categorySums[cat] ?? 0) + total;
  }
  return Object.entries(categorySums).map(([category, quantity]) => ({
    category,
    quantity: Math.round(quantity * 100) / 100,
  }));
}

/**
 * My movements over last N days (for staff chart)
 */
export async function getMyMovementsTrend(
  userId: string,
  days: number,
  deps?: DashboardRepoDeps
): Promise<{ date: string; count: number }[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return getMyMovementsTrendByRange(userId, start, end, deps);
}

/**
 * My movements for a custom date range (for staff chart)
 */
export async function getMyMovementsTrendByRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  deps?: DashboardRepoDeps
): Promise<{ date: string; count: number }[]> {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const days = getDaysBetween(start, end);

  const movements = await getPrisma(deps).stockMovement.findMany({
    where: { createdById: userId, createdAt: { gte: start, lte: end } },
    select: { createdAt: true },
  });

  const byDate: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    byDate[d.toISOString().slice(0, 10)] = 0;
  }
  for (const m of movements) {
    const key = new Date(m.createdAt).toISOString().slice(0, 10);
    byDate[key] = (byDate[key] ?? 0) + 1;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Low stock products (with total available), limit N
 */
export async function getLowStockProducts(
  limit: number,
  deps?: DashboardRepoDeps
): Promise<
  { id: string; sku: string; name: string; category: string | null; unit: string; price: number | null; totalAvailable: number }[]
> {
  const products = await getPrisma(deps).product.findMany({
    where: { isActive: true },
    include: { stockBalances: { select: { available: true } } },
    orderBy: { name: 'asc' },
  });

  const withTotal = products
    .map((p) => ({
      ...p,
      totalAvailable: p.stockBalances.reduce((s, b) => s + Number(b.available), 0),
    }))
    .filter((p) => p.totalAvailable < LOW_STOCK_THRESHOLD && p.totalAvailable >= 0)
    .sort((a, b) => a.totalAvailable - b.totalAvailable)
    .slice(0, limit);

  return withTotal.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    unit: p.unit,
    price: p.price != null ? Number(p.price) : null,
    totalAvailable: p.totalAvailable,
  }));
}

/**
 * Recent stock movements (any type), limit N
 */
export async function getRecentMovements(
  limit: number,
  deps?: DashboardRepoDeps
): Promise<
  {
    id: string;
    movementType: string;
    quantity: number;
    referenceNumber: string | null;
    createdAt: Date;
    productName: string;
    warehouseName: string;
  }[]
> {
  const rows = await getPrisma(deps).stockMovement.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });
  return rows.map((m) => ({
    id: m.id,
    movementType: m.movementType,
    quantity: Number(m.quantity),
    referenceNumber: m.referenceNumber,
    createdAt: m.createdAt,
    productName: m.product.name,
    warehouseName: m.warehouse.name,
  }));
}

/**
 * Recent OUT (sales) movements, limit N
 */
export async function getRecentSales(
  limit: number,
  deps?: DashboardRepoDeps
): Promise<
  {
    id: string;
    quantity: number;
    referenceNumber: string | null;
    createdAt: Date;
    productName: string;
    value: number;
  }[]
> {
  const rows = await getPrisma(deps).stockMovement.findMany({
    where: { movementType: 'OUT' },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { name: true, price: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    quantity: Number(m.quantity),
    referenceNumber: m.referenceNumber,
    createdAt: m.createdAt,
    productName: m.product.name,
    value: (m.product.price ? Number(m.product.price) : 0) * Number(m.quantity),
  }));
}

/**
 * Recent IN (purchases) movements, limit N
 */
export async function getRecentPurchases(
  limit: number,
  deps?: DashboardRepoDeps
): Promise<
  {
    id: string;
    quantity: number;
    referenceNumber: string | null;
    createdAt: Date;
    productName: string;
    value: number;
  }[]
> {
  const rows = await getPrisma(deps).stockMovement.findMany({
    where: { movementType: 'IN' },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { name: true, price: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    quantity: Number(m.quantity),
    referenceNumber: m.referenceNumber,
    createdAt: m.createdAt,
    productName: m.product.name,
    value: (m.product.price ? Number(m.product.price) : 0) * Number(m.quantity),
  }));
}

/**
 * Latest audit logs, limit N
 */
export async function getRecentAuditLogs(
  limit: number,
  deps?: DashboardRepoDeps
): Promise<
  {
    id: string;
    action: string;
    resource: string;
    description: string | null;
    createdAt: Date;
    userEmail: string | null;
  }[]
> {
  const rows = await getPrisma(deps).auditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    action: a.action,
    resource: a.resource,
    description: a.description,
    createdAt: a.createdAt,
    userEmail: a.user?.email ?? null,
  }));
}

/**
 * Top N product/warehouse pairs most likely to stock out (lowest days of cover).
 * Uses InventoryMetrics; returns product name, warehouse name, daysOfCover, predictedStockoutDate.
 */
export async function getLikelyToStockOut(
  limit: number,
  deps?: DashboardRepoDeps
): Promise<
  {
    productId: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    daysOfCover: number;
    predictedStockoutDate: Date | null;
  }[]
> {
  const rows = await getPrisma(deps).inventoryMetrics.findMany({
    where: {
      product: { isActive: true },
      warehouse: { isActive: true },
    },
    orderBy: { daysOfCover: 'asc' },
    take: limit,
    include: {
      product: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });

  return rows
    .filter((r) => {
      const d = Number(r.daysOfCover);
      return Number.isFinite(d) && d >= 0;
    })
    .slice(0, limit)
    .map((r) => ({
      productId: r.productId,
      productName: r.product.name,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse.name,
      daysOfCover: Number(r.daysOfCover),
      predictedStockoutDate: r.predictedStockoutDate,
    }));
}

export { LOW_STOCK_THRESHOLD };
