import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const LOW_STOCK_THRESHOLD = 10;

export interface ReportRepoDeps {
  prisma?: PrismaClient;
}

function getPrisma(deps?: ReportRepoDeps) {
  return deps?.prisma ?? prisma;
}

function toDateRange(from?: string, to?: string, range?: string): { from: Date; to: Date } {
  const now = new Date();
  let start: Date;
  const rangeDays = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  start = new Date(now);
  start.setDate(start.getDate() - rangeDays);
  if (from) start = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

/** Total stock value: sum(balance.quantity * product.costPrice), optional warehouse/category/date */
export async function getTotalStockValue(
  opts: { warehouseId?: string; category?: string; from?: string; to?: string; range?: string },
  deps?: ReportRepoDeps
): Promise<number> {
  const db = getPrisma(deps);
  const { from, to } = toDateRange(opts.from, opts.to, opts.range);
  const whereProduct: Prisma.ProductWhereInput = { isActive: true };
  if (opts.category) whereProduct.category = opts.category;
  const whereBalance: Prisma.StockBalanceWhereInput = {
    product: whereProduct,
  };
  if (opts.warehouseId) whereBalance.warehouseId = opts.warehouseId;

  const balances = await db.stockBalance.findMany({
    where: whereBalance,
    include: { product: { select: { costPrice: true } } },
  });
  let total = 0;
  for (const b of balances) {
    const qty = Number(b.quantity);
    const cost = b.product.costPrice != null ? Number(b.product.costPrice) : 0;
    total += qty * cost;
  }
  return Math.round(total * 100) / 100;
}

/** Count of products where total available < reorderLevel or < LOW_STOCK_THRESHOLD */
export async function getLowStockCount(
  opts: { warehouseId?: string; category?: string },
  deps?: ReportRepoDeps
): Promise<number> {
  const db = getPrisma(deps);
  const whereProduct: Prisma.ProductWhereInput = { isActive: true };
  if (opts.category) whereProduct.category = opts.category;
  const products = await db.product.findMany({
    where: whereProduct,
    include: {
      stockBalances: opts.warehouseId
        ? { where: { warehouseId: opts.warehouseId }, select: { available: true } }
        : { select: { available: true } },
    },
  });
  return products.filter((p) => {
    const total = p.stockBalances.reduce((s, b) => s + Number(b.available), 0);
    const threshold = p.reorderLevel != null ? Number(p.reorderLevel) : LOW_STOCK_THRESHOLD;
    return total < threshold && total >= 0;
  }).length;
}

/** Total OUT (sales) value in date range */
export async function getTotalSalesInRange(
  opts: { from: Date; to: Date; warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<number> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    movementType: 'OUT',
    createdAt: { gte: opts.from, lte: opts.to },
  };
  if (opts.warehouseId) where.warehouseId = opts.warehouseId;
  const movements = await db.stockMovement.findMany({
    where,
    include: { product: { select: { price: true } } },
  });
  let total = 0;
  for (const m of movements) {
    const price = m.product.price != null ? Number(m.product.price) : 0;
    total += Number(m.quantity) * price;
  }
  return Math.round(total * 100) / 100;
}

/** Total IN (purchases) value in date range */
export async function getTotalPurchasesInRange(
  opts: { from: Date; to: Date; warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<number> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    movementType: 'IN',
    createdAt: { gte: opts.from, lte: opts.to },
  };
  if (opts.warehouseId) where.warehouseId = opts.warehouseId;
  const movements = await db.stockMovement.findMany({
    where,
    include: { product: { select: { price: true } } },
  });
  let total = 0;
  for (const m of movements) {
    const price = m.product.price != null ? Number(m.product.price) : 0;
    total += Number(m.quantity) * price;
  }
  return Math.round(total * 100) / 100;
}

/** IN - OUT net movement value in range */
export async function getNetMovementInRange(
  opts: { from: Date; to: Date; warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<number> {
  const [purchases, sales] = await Promise.all([
    getTotalPurchasesInRange(opts, deps),
    getTotalSalesInRange(opts, deps),
  ]);
  return Math.round((purchases - sales) * 100) / 100;
}

/** Sales vs Purchases trend by day */
export async function getSalesVsPurchasesTrend(
  opts: { from: Date; to: Date; warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<{ date: string; sales: number; purchases: number }[]> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    createdAt: { gte: opts.from, lte: opts.to },
    movementType: { in: ['IN', 'OUT'] },
  };
  if (opts.warehouseId) where.warehouseId = opts.warehouseId;
  const movements = await db.stockMovement.findMany({
    where,
    select: { movementType: true, quantity: true, createdAt: true, productId: true },
  });
  const productIds = [...new Set(movements.map((m) => m.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, price: true },
  });
  const priceMap = new Map(products.map((p) => [p.id, p.price != null ? Number(p.price) : 0]));

  const byDate: Record<string, { sales: number; purchases: number }> = {};
  const days = Math.ceil((opts.to.getTime() - opts.from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(opts.from);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = { sales: 0, purchases: 0 };
  }
  for (const m of movements) {
    const key = new Date(m.createdAt).toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = { sales: 0, purchases: 0 };
    const price = priceMap.get(m.productId) ?? 0;
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

/** IN vs OUT quantity trend by day */
export async function getMovementTrend(
  opts: { from: Date; to: Date; warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<{ date: string; in: number; out: number }[]> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    createdAt: { gte: opts.from, lte: opts.to },
  };
  if (opts.warehouseId) where.warehouseId = opts.warehouseId;
  const movements = await db.stockMovement.findMany({
    where,
    select: { movementType: true, quantity: true, createdAt: true },
  });
  const byDate: Record<string, { in: number; out: number }> = {};
  const days = Math.ceil((opts.to.getTime() - opts.from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(opts.from);
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

/** Stock value by warehouse (bar chart) */
export async function getStockValueByWarehouse(
  opts: { category?: string },
  deps?: ReportRepoDeps
): Promise<{ warehouseId: string; warehouseName: string; value: number }[]> {
  const db = getPrisma(deps);
  const whereProduct: Prisma.ProductWhereInput = { isActive: true };
  if (opts.category) whereProduct.category = opts.category;
  const balances = await db.stockBalance.findMany({
    where: { product: whereProduct },
    include: {
      product: { select: { costPrice: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });
  const byWh: Record<string, { name: string; value: number }> = {};
  for (const b of balances) {
    const id = b.warehouse.id;
    if (!byWh[id]) byWh[id] = { name: b.warehouse.name, value: 0 };
    const cost = b.product.costPrice != null ? Number(b.product.costPrice) : 0;
    byWh[id].value += Number(b.quantity) * cost;
  }
  return Object.entries(byWh).map(([warehouseId, v]) => ({
    warehouseId,
    warehouseName: v.name,
    value: Math.round(v.value * 100) / 100,
  }));
}

/** Stock value by category */
export async function getStockValueByCategory(
  opts: { warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<{ category: string; value: number }[]> {
  const db = getPrisma(deps);
  const whereBalance: Prisma.StockBalanceWhereInput = {};
  if (opts.warehouseId) whereBalance.warehouseId = opts.warehouseId;
  const balances = await db.stockBalance.findMany({
    where: whereBalance,
    include: { product: { select: { category: true, costPrice: true } } },
  });
  const byCat: Record<string, number> = {};
  for (const b of balances) {
    const cat = b.product.category ?? 'Uncategorized';
    const cost = b.product.costPrice != null ? Number(b.product.costPrice) : 0;
    byCat[cat] = (byCat[cat] ?? 0) + Number(b.quantity) * cost;
  }
  return Object.entries(byCat).map(([category, value]) => ({
    category,
    value: Math.round(value * 100) / 100,
  }));
}

/** Top moved products by quantity (absolute sum) in range */
export async function getTopMovedProducts(
  opts: { from: Date; to: Date; warehouseId?: string; limit: number },
  deps?: ReportRepoDeps
): Promise<{ productId: string; productName: string; sku: string; totalQty: number }[]> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    createdAt: { gte: opts.from, lte: opts.to },
  };
  if (opts.warehouseId) where.warehouseId = opts.warehouseId;
  const movements = await db.stockMovement.findMany({
    where,
    select: { productId: true, quantity: true, movementType: true },
  });
  const byProduct: Record<string, number> = {};
  for (const m of movements) {
    const q = Number(m.quantity);
    byProduct[m.productId] = (byProduct[m.productId] ?? 0) + q;
  }
  const productIds = Object.keys(byProduct).sort((a, b) => (byProduct[b] ?? 0) - (byProduct[a] ?? 0)).slice(0, opts.limit);
  if (productIds.length === 0) return [];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  return productIds.map((id) => {
    const p = map.get(id);
    return {
      productId: id,
      productName: p?.name ?? '',
      sku: p?.sku ?? '',
      totalQty: byProduct[id] ?? 0,
    };
  });
}

/** Low stock products for overview preview */
export async function getLowStockProductsPreview(
  opts: { warehouseId?: string; category?: string; limit: number },
  deps?: ReportRepoDeps
): Promise<
  { id: string; sku: string; name: string; category: string | null; totalAvailable: number; reorderLevel: number | null }[]
> {
  const db = getPrisma(deps);
  const whereProduct: Prisma.ProductWhereInput = { isActive: true };
  if (opts.category) whereProduct.category = opts.category;
  const products = await db.product.findMany({
    where: whereProduct,
    include: {
      stockBalances: opts.warehouseId
        ? { where: { warehouseId: opts.warehouseId }, select: { available: true } }
        : { select: { available: true } },
    },
  });
  const withTotal = products
    .map((p) => ({
      ...p,
      totalAvailable: p.stockBalances.reduce((s, b) => s + Number(b.available), 0),
    }))
    .filter((p) => {
      const threshold = p.reorderLevel != null ? Number(p.reorderLevel) : LOW_STOCK_THRESHOLD;
      return p.totalAvailable < threshold && p.totalAvailable >= 0;
    })
    .sort((a, b) => a.totalAvailable - b.totalAvailable)
    .slice(0, opts.limit);
  return withTotal.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    totalAvailable: p.totalAvailable,
    reorderLevel: p.reorderLevel != null ? Number(p.reorderLevel) : null,
  }));
}

/** Top selling products (OUT) by quantity in range */
export async function getTopSellingProducts(
  opts: { from: Date; to: Date; warehouseId?: string; limit: number },
  deps?: ReportRepoDeps
): Promise<{ productId: string; productName: string; sku: string; quantity: number; value: number }[]> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    movementType: 'OUT',
    createdAt: { gte: opts.from, lte: opts.to },
  };
  if (opts.warehouseId) where.warehouseId = opts.warehouseId;
  const movements = await db.stockMovement.findMany({
    where,
    include: { product: { select: { id: true, name: true, sku: true, price: true } } },
  });
  const byProduct: Record<string, { qty: number; value: number; name: string; sku: string }> = {};
  for (const m of movements) {
    const id = m.productId;
    const qty = Number(m.quantity);
    const price = m.product.price != null ? Number(m.product.price) : 0;
    const value = qty * price;
    if (!byProduct[id])
      byProduct[id] = { qty: 0, value: 0, name: m.product.name, sku: m.product.sku };
    byProduct[id].qty += qty;
    byProduct[id].value += value;
  }
  return Object.entries(byProduct)
    .sort((_, b) => b[1].qty - byProduct[b[0]].qty)
    .slice(0, opts.limit)
    .map(([productId, v]) => ({
      productId,
      productName: v.name,
      sku: v.sku,
      quantity: v.qty,
      value: Math.round(v.value * 100) / 100,
    }));
}

// --- Inventory report (stock on hand) ---
export interface InventoryListParams {
  warehouseId?: string;
  category?: string;
  q?: string;
  lowStockOnly?: boolean;
  page: number;
  pageSize: number;
  sort?: 'name' | 'sku' | 'onHand' | 'stockValue' | 'category';
  order?: 'asc' | 'desc';
}

export interface InventoryRow {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  reorderLevel: number | null;
  unitCost: number | null;
  stockValue: number;
  isLowStock: boolean;
}

export interface InventoryListResult {
  rows: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getInventoryList(
  params: InventoryListParams,
  deps?: ReportRepoDeps
): Promise<InventoryListResult> {
  const db = getPrisma(deps);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const whereProduct: Prisma.ProductWhereInput = { isActive: true };
  if (params.category) whereProduct.category = params.category;
  if (params.q?.trim()) {
    const q = params.q.trim();
    whereProduct.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }

  const whereBalance: Prisma.StockBalanceWhereInput = { product: whereProduct };
  if (params.warehouseId) whereBalance.warehouseId = params.warehouseId;

  const balances = await db.stockBalance.findMany({
    where: whereBalance,
    include: {
      product: { select: { id: true, sku: true, name: true, category: true, reorderLevel: true, costPrice: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  let rows: InventoryRow[] = balances.map((b) => {
    const onHand = Number(b.quantity);
    const unitCost = b.product.costPrice != null ? Number(b.product.costPrice) : null;
    const stockValue = unitCost != null ? onHand * unitCost : 0;
    const reorderLevel = b.product.reorderLevel != null ? Number(b.product.reorderLevel) : null;
    const threshold = reorderLevel ?? LOW_STOCK_THRESHOLD;
    const isLowStock = onHand < threshold && onHand >= 0;
    return {
      productId: b.product.id,
      sku: b.product.sku,
      name: b.product.name,
      category: b.product.category,
      warehouseId: b.warehouse.id,
      warehouseName: b.warehouse.name,
      onHand,
      reorderLevel,
      unitCost,
      stockValue: Math.round(stockValue * 100) / 100,
      isLowStock,
    };
  });

  if (params.lowStockOnly) rows = rows.filter((r) => r.isLowStock);

  const sortKey = params.sort ?? 'name';
  const order = params.order ?? 'asc';
  rows.sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    if (sortKey === 'stockValue') {
      va = a.stockValue;
      vb = b.stockValue;
    } else if (sortKey === 'onHand') {
      va = a.onHand;
      vb = b.onHand;
    } else if (sortKey === 'category') {
      va = a.category ?? '';
      vb = b.category ?? '';
    } else if (sortKey === 'sku') {
      va = a.sku;
      vb = b.sku;
    } else {
      va = a.name;
      vb = b.name;
    }
    const cmp = typeof va === 'string' ? String(va).localeCompare(String(vb)) : va - (vb as number);
    return order === 'asc' ? cmp : -cmp;
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  rows = rows.slice(start, start + pageSize);

  return { rows, total, page, pageSize };
}

// --- Movements report: reuse stockMovementRepo listMovements type and buildWhere; we'll call listMovements from service with date range.

// --- Sales report: aggregated from OUT movements
export interface SalesListParams {
  from: Date;
  to: Date;
  warehouseId?: string;
  page: number;
  pageSize: number;
}

export interface SalesRow {
  date: string;
  referenceNumber: string | null;
  customer: string | null;
  total: number;
  status: string;
  createdById: string | null;
  createdByEmail: string | null;
  createdByName: string | null;
}

export async function getSalesList(
  params: SalesListParams,
  deps?: ReportRepoDeps
): Promise<{ rows: SalesRow[]; total: number; page: number; pageSize: number }> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    movementType: 'OUT',
    createdAt: { gte: params.from, lte: params.to },
  };
  if (params.warehouseId) where.warehouseId = params.warehouseId;

  const movements = await db.stockMovement.findMany({
    where,
    include: {
      product: { select: { price: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by referenceNumber (or id if no ref) for "order" rows
  const groupKey = (m: (typeof movements)[0]) => m.referenceNumber ?? m.id;
  const groups = new Map<string, (typeof movements)[0][]>();
  for (const m of movements) {
    const key = groupKey(m);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const rows: SalesRow[] = [];
  for (const [, items] of groups) {
    const first = items[0]!;
    let total = 0;
    for (const m of items) {
      const price = m.product.price != null ? Number(m.product.price) : 0;
      total += Number(m.quantity) * price;
    }
    rows.push({
      date: first.createdAt.toISOString(),
      referenceNumber: first.referenceNumber,
      customer: null,
      total: Math.round(total * 100) / 100,
      status: 'Completed',
      createdById: first.createdById,
      createdByEmail: first.createdBy?.email ?? null,
      createdByName: first.createdBy?.name ?? null,
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));

  const total = rows.length;
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize);

  return { rows: paged, total, page, pageSize };
}

/** Sales totals for cards */
export async function getSalesTotals(
  opts: { from: Date; to: Date; warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<{ totalAmount: number; orderCount: number; avgOrderValue: number }> {
  const { rows, total } = await getSalesList(
    { from: opts.from, to: opts.to, warehouseId: opts.warehouseId, page: 1, pageSize: 1 },
    deps
  );
  const allRows = await getSalesList(
    { from: opts.from, to: opts.to, warehouseId: opts.warehouseId, page: 1, pageSize: 10000 },
    deps
  );
  const totalAmount = allRows.rows.reduce((s, r) => s + r.total, 0);
  const orderCount = allRows.total;
  const avgOrderValue = orderCount > 0 ? Math.round((totalAmount / orderCount) * 100) / 100 : 0;
  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    orderCount,
    avgOrderValue,
  };
}

// --- Purchases report: from IN movements
export interface PurchasesListParams {
  from: Date;
  to: Date;
  warehouseId?: string;
  page: number;
  pageSize: number;
}

export interface PurchaseRow {
  date: string;
  referenceNumber: string | null;
  supplier: string | null;
  total: number;
  status: string;
  createdById: string | null;
  createdByEmail: string | null;
  createdByName: string | null;
}

export async function getPurchasesList(
  params: PurchasesListParams,
  deps?: ReportRepoDeps
): Promise<{ rows: PurchaseRow[]; total: number; page: number; pageSize: number }> {
  const db = getPrisma(deps);
  const where: Prisma.StockMovementWhereInput = {
    movementType: 'IN',
    createdAt: { gte: params.from, lte: params.to },
  };
  if (params.warehouseId) where.warehouseId = params.warehouseId;

  const movements = await db.stockMovement.findMany({
    where,
    include: {
      product: { select: { price: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const groupKey = (m: (typeof movements)[0]) => m.referenceNumber ?? m.id;
  const groups = new Map<string, (typeof movements)[0][]>();
  for (const m of movements) {
    const key = groupKey(m);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const rows: PurchaseRow[] = [];
  for (const [, items] of groups) {
    const first = items[0]!;
    let total = 0;
    for (const m of items) {
      const price = m.product.price != null ? Number(m.product.price) : 0;
      total += Number(m.quantity) * price;
    }
    rows.push({
      date: first.createdAt.toISOString(),
      referenceNumber: first.referenceNumber,
      supplier: null,
      total: Math.round(total * 100) / 100,
      status: 'Completed',
      createdById: first.createdById,
      createdByEmail: first.createdBy?.email ?? null,
      createdByName: first.createdBy?.name ?? null,
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));

  const total = rows.length;
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize);

  return { rows: paged, total, page, pageSize };
}

export async function getPurchasesTotals(
  opts: { from: Date; to: Date; warehouseId?: string },
  deps?: ReportRepoDeps
): Promise<{ totalAmount: number; orderCount: number }> {
  const allRows = await getPurchasesList(
    { from: opts.from, to: opts.to, warehouseId: opts.warehouseId, page: 1, pageSize: 10000 },
    deps
  );
  const totalAmount = allRows.rows.reduce((s, r) => s + r.total, 0);
  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    orderCount: allRows.total,
  };
}

/** Purchases by "supplier" - we use warehouse as proxy */
export async function getPurchasesByWarehouse(
  opts: { from: Date; to: Date; limit: number },
  deps?: ReportRepoDeps
): Promise<{ warehouseName: string; total: number }[]> {
  const db = getPrisma(deps);
  const movements = await db.stockMovement.findMany({
    where: {
      movementType: 'IN',
      createdAt: { gte: opts.from, lte: opts.to },
    },
    include: {
      warehouse: { select: { name: true } },
      product: { select: { price: true } },
    },
  });
  const byWh: Record<string, number> = {};
  for (const m of movements) {
    const name = m.warehouse.name;
    const value = Number(m.quantity) * (m.product.price != null ? Number(m.product.price) : 0);
    byWh[name] = (byWh[name] ?? 0) + value;
  }
  return Object.entries(byWh)
    .map(([warehouseName, total]) => ({ warehouseName, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, opts.limit);
}

// --- Audit report
export interface AuditListParams {
  from?: Date;
  to?: Date;
  actorId?: string;
  action?: string;
  resource?: string;
  page: number;
  pageSize: number;
}

export interface AuditRow {
  id: string;
  date: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadataSummary: string | null;
}

export async function getAuditList(
  params: AuditListParams,
  deps?: ReportRepoDeps
): Promise<{ rows: AuditRow[]; total: number; page: number; pageSize: number }> {
  const db = getPrisma(deps);
  const where: Prisma.AuditLogWhereInput = {};
  if (params.from ?? params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = params.from;
    if (params.to) {
      const to = new Date(params.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }
  if (params.actorId) where.userId = params.actorId;
  if (params.action) where.action = params.action as Prisma.EnumAuditLogActionFilter;
  if (params.resource) where.resource = params.resource;

  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    db.auditLog.count({ where }),
  ]);

  const rows: AuditRow[] = logs.map((a) => ({
    id: a.id,
    date: a.createdAt.toISOString(),
    actorId: a.userId,
    actorEmail: a.user?.email ?? null,
    actorName: a.user?.name ?? null,
    action: a.action,
    resource: a.resource,
    resourceId: a.resourceId,
    metadataSummary: a.metadata ? JSON.stringify(a.metadata).slice(0, 100) : null,
  }));

  return { rows, total, page, pageSize };
}

/** Distinct product category names for filter dropdown */
export async function getDistinctCategories(deps?: ReportRepoDeps): Promise<string[]> {
  const db = getPrisma(deps);
  const products = await db.product.findMany({
    where: { isActive: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
  });
  return products
    .map((p) => p.category)
    .filter((c): c is string => c != null && c !== '')
    .sort((a, b) => a.localeCompare(b));
}

export { LOW_STOCK_THRESHOLD };
