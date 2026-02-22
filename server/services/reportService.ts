import type { UserWithPermissions } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import * as reportRepo from '@/server/repositories/reportRepo';
import * as stockMovementRepo from '@/server/repositories/stockMovementRepo';

export type DateRange = '7d' | '30d' | '90d' | 'custom';

export function parseReportDateRange(
  range?: string,
  from?: string,
  to?: string
): { from: Date; to: Date } {
  const now = new Date();
  let start: Date;
  switch (range) {
    case '7d':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case '90d':
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      break;
    case 'custom':
      start = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now);
      start.setDate(start.getDate() - 30);
  }
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date(now);
  end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

const REPORT_READ = ['reports.read', 'reports:read'];
const INVENTORY_READ = ['inventory.read', 'inventory:read', 'reports.read', 'reports:read'];
const WAREHOUSE_READ = ['warehouse.read', 'warehouse:read'];
const SALES_READ = ['sales.read', 'sales:read'];
const PURCHASE_READ = ['purchase.read', 'purchase:read'];
const AUDIT_READ = ['audit.read', 'audit:read'];
const EXPORT_READ = ['export.read', 'reports.read', 'reports:read'];

function userHasAny(user: UserWithPermissions, permissions: string[]): boolean {
  return permissions.some((p) => user.permissions.includes(p));
}

export interface OverviewFilters {
  from?: string;
  to?: string;
  range?: string;
  warehouseId?: string;
  category?: string;
}

export interface ReportOverviewResult {
  totalStockValue?: number;
  lowStockCount?: number;
  totalSales?: number;
  totalPurchases?: number;
  netMovement?: number;
  salesVsPurchasesTrend?: { date: string; sales: number; purchases: number }[];
  movementTrend?: { date: string; in: number; out: number }[];
  stockValueByWarehouse?: { warehouseId: string; warehouseName: string; value: number }[];
  stockValueByCategory?: { category: string; value: number }[];
  topMovedProducts?: { productId: string; productName: string; sku: string; totalQty: number }[];
  lowStockProducts?: {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    totalAvailable: number;
    reorderLevel: number | null;
  }[];
  topSellingProducts?: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    value: number;
  }[];
}

export async function getReportOverview(
  user: UserWithPermissions,
  filters: OverviewFilters
): Promise<ReportOverviewResult> {
  if (!userHasAny(user, REPORT_READ)) return {};

  const { from, to } = parseReportDateRange(filters.range, filters.from, filters.to);
  const opts = {
    warehouseId: filters.warehouseId,
    category: filters.category,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    range: filters.range,
  };
  const dateOpts = { from, to, warehouseId: filters.warehouseId };
  const result: ReportOverviewResult = {};

  const canInventory = userHasAny(user, INVENTORY_READ);
  const canWarehouse = userHasAny(user, WAREHOUSE_READ);
  const canSales = userHasAny(user, SALES_READ);
  const canPurchase = userHasAny(user, PURCHASE_READ);

  if (canInventory) {
    const [totalStockValue, lowStockCount, lowStockProducts] = await Promise.all([
      reportRepo.getTotalStockValue(opts),
      reportRepo.getLowStockCount({ warehouseId: filters.warehouseId, category: filters.category }),
      reportRepo.getLowStockProductsPreview({
        warehouseId: filters.warehouseId,
        category: filters.category,
        limit: 10,
      }),
    ]);
    result.totalStockValue = totalStockValue;
    result.lowStockCount = lowStockCount;
    result.lowStockProducts = lowStockProducts;
  }

  if (canSales) {
    result.totalSales = await reportRepo.getTotalSalesInRange(dateOpts);
  }
  if (canPurchase) {
    result.totalPurchases = await reportRepo.getTotalPurchasesInRange(dateOpts);
  }
  if ((canSales || canPurchase) && (canSales && canPurchase)) {
    result.netMovement = await reportRepo.getNetMovementInRange(dateOpts);
  } else if (canPurchase) {
    result.netMovement = (result.totalPurchases ?? 0) - 0;
  } else if (canSales) {
    result.netMovement = 0 - (result.totalSales ?? 0);
  }

  if (canInventory) {
    const [movementTrend, salesVsPurchases, topMoved] = await Promise.all([
      reportRepo.getMovementTrend(dateOpts),
      (canSales || canPurchase) ? reportRepo.getSalesVsPurchasesTrend(dateOpts) : Promise.resolve([]),
      reportRepo.getTopMovedProducts({ ...dateOpts, limit: 10 }),
    ]);
    result.movementTrend = movementTrend;
    result.salesVsPurchasesTrend = salesVsPurchases;
    result.topMovedProducts = topMoved;
  }

  if (canSales) {
    result.topSellingProducts = await reportRepo.getTopSellingProducts({
      ...dateOpts,
      limit: 10,
    });
  }

  if (canInventory && (canWarehouse || !filters.warehouseId)) {
    result.stockValueByWarehouse = await reportRepo.getStockValueByWarehouse({
      category: filters.category,
    });
    result.stockValueByCategory = await reportRepo.getStockValueByCategory({
      warehouseId: filters.warehouseId,
    });
  }

  return result;
}

export interface InventoryListQuery {
  from?: string;
  to?: string;
  range?: string;
  warehouseId?: string;
  category?: string;
  q?: string;
  lowStockOnly?: boolean;
  page?: string;
  pageSize?: string;
  sort?: string;
  order?: string;
}

export async function getInventoryReport(
  user: UserWithPermissions,
  query: InventoryListQuery
): Promise<{
  rows: reportRepo.InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  if (!userHasAny(user, INVENTORY_READ)) {
    return { rows: [], total: 0, page: 1, pageSize: 20 };
  }
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));
  const sort = (['name', 'sku', 'onHand', 'stockValue', 'category'] as const).includes(query.sort as 'name')
    ? (query.sort as reportRepo.InventoryListParams['sort'])
    : 'name';
  const order = query.order === 'asc' ? 'asc' : 'desc';

  return reportRepo.getInventoryList(
    {
      warehouseId: query.warehouseId,
      category: query.category,
      q: query.q,
      lowStockOnly: query.lowStockOnly,
      page,
      pageSize,
      sort,
      order,
    }
  );
}

export interface MovementsListQuery {
  from?: string;
  to?: string;
  range?: string;
  warehouseId?: string;
  type?: string;
  referenceType?: string;
  performedBy?: string;
  page?: string;
  pageSize?: string;
}

export interface MovementReportRow {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: string;
  quantity: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string; code: string | null };
  createdBy: { id: string; name: string | null; email: string } | null;
}

export async function getMovementsReport(
  user: UserWithPermissions,
  query: MovementsListQuery
): Promise<{
  rows: MovementReportRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  if (!userHasAny(user, INVENTORY_READ)) {
    return { rows: [], total: 0, page: 1, pageSize: 20 };
  }
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));
  const type =
    query.type === 'IN' || query.type === 'OUT' || query.type === 'TRANSFER' || query.type === 'ADJUSTMENT'
      ? query.type
      : undefined;
  const referenceType =
    query.referenceType === 'PURCHASE' ||
    query.referenceType === 'SALE' ||
    query.referenceType === 'TRANSFER' ||
    query.referenceType === 'ADJUSTMENT' ||
    query.referenceType === 'MANUAL'
      ? query.referenceType
      : undefined;

  const params: stockMovementRepo.ListMovementsParams = {
    from,
    to,
    warehouseId: query.warehouseId,
    type,
    referenceType,
    performedBy: query.performedBy,
    page,
    pageSize,
    sort: 'createdAt',
    order: 'desc',
  };
  const result = await stockMovementRepo.listMovements(params, prisma);
  const rows: MovementReportRow[] = result.rows.map((m) => ({
    ...m,
    quantity: typeof m.quantity === 'string' ? m.quantity : String(m.quantity),
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
  }));
  return {
    rows,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

export async function getMovementsReportExport(
  user: UserWithPermissions,
  query: Omit<MovementsListQuery, 'page' | 'pageSize'>
): Promise<MovementReportRow[]> {
  if (!userHasAny(user, EXPORT_READ) && !userHasAny(user, INVENTORY_READ)) return [];
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const type =
    query.type === 'IN' || query.type === 'OUT' || query.type === 'TRANSFER' || query.type === 'ADJUSTMENT'
      ? query.type
      : undefined;
  const referenceType =
    query.referenceType === 'PURCHASE' ||
    query.referenceType === 'SALE' ||
    query.referenceType === 'TRANSFER' ||
    query.referenceType === 'ADJUSTMENT' ||
    query.referenceType === 'MANUAL'
      ? query.referenceType
      : undefined;
  const rows = await stockMovementRepo.listMovementsForExport(
    {
      from,
      to,
      warehouseId: query.warehouseId,
      type,
      referenceType,
      performedBy: query.performedBy,
      order: 'desc',
    },
    prisma,
    5000
  );
  return rows.map((m) => ({
    ...m,
    quantity: typeof m.quantity === 'string' ? m.quantity : String(m.quantity),
    createdAt: m.createdAt.toISOString(),
  }));
}

export interface SalesListQuery {
  from?: string;
  to?: string;
  range?: string;
  warehouseId?: string;
  page?: string;
  pageSize?: string;
}

export async function getSalesReport(
  user: UserWithPermissions,
  query: SalesListQuery
): Promise<{
  totals?: { totalAmount: number; orderCount: number; avgOrderValue: number };
  trend?: { date: string; sales: number }[];
  topProducts?: { productId: string; productName: string; sku: string; quantity: number; value: number }[];
  rows: reportRepo.SalesRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  if (!userHasAny(user, SALES_READ)) {
    return { rows: [], total: 0, page: 1, pageSize: 20 };
  }
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const dateOpts = { from, to, warehouseId: query.warehouseId };
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));

  const [totals, trend, topProducts, list] = await Promise.all([
    reportRepo.getSalesTotals(dateOpts),
    reportRepo.getSalesVsPurchasesTrend(dateOpts).then((arr) =>
      arr.map(({ date, sales }) => ({ date, sales }))
    ),
    reportRepo.getTopSellingProducts({ ...dateOpts, limit: 10 }),
    reportRepo.getSalesList({ ...dateOpts, page, pageSize }),
  ]);

  return {
    totals,
    trend,
    topProducts,
    rows: list.rows,
    total: list.total,
    page: list.page,
    pageSize: list.pageSize,
  };
}

export async function getSalesExport(
  user: UserWithPermissions,
  query: Omit<SalesListQuery, 'page' | 'pageSize'>
): Promise<reportRepo.SalesRow[]> {
  if (!userHasAny(user, EXPORT_READ) && !userHasAny(user, SALES_READ)) return [];
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const list = await reportRepo.getSalesList({
    from,
    to,
    warehouseId: query.warehouseId,
    page: 1,
    pageSize: 5000,
  });
  return list.rows;
}

export interface PurchasesListQuery {
  from?: string;
  to?: string;
  range?: string;
  warehouseId?: string;
  page?: string;
  pageSize?: string;
}

export async function getPurchasesReport(
  user: UserWithPermissions,
  query: PurchasesListQuery
): Promise<{
  totals?: { totalAmount: number; orderCount: number };
  trend?: { date: string; purchases: number }[];
  byWarehouse?: { warehouseName: string; total: number }[];
  rows: reportRepo.PurchaseRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  if (!userHasAny(user, PURCHASE_READ)) {
    return { rows: [], total: 0, page: 1, pageSize: 20 };
  }
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const dateOpts = { from, to, warehouseId: query.warehouseId };
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));

  const [totals, trendFull, byWarehouse, list] = await Promise.all([
    reportRepo.getPurchasesTotals(dateOpts),
    reportRepo.getSalesVsPurchasesTrend(dateOpts).then((arr) =>
      arr.map(({ date, purchases }) => ({ date, purchases }))
    ),
    reportRepo.getPurchasesByWarehouse({ from, to, limit: 10 }),
    reportRepo.getPurchasesList({ ...dateOpts, page, pageSize }),
  ]);

  return {
    totals,
    trend: trendFull,
    byWarehouse,
    rows: list.rows,
    total: list.total,
    page: list.page,
    pageSize: list.pageSize,
  };
}

export async function getPurchasesExport(
  user: UserWithPermissions,
  query: Omit<PurchasesListQuery, 'page' | 'pageSize'>
): Promise<reportRepo.PurchaseRow[]> {
  if (!userHasAny(user, EXPORT_READ) && !userHasAny(user, PURCHASE_READ)) return [];
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const list = await reportRepo.getPurchasesList({
    from,
    to,
    warehouseId: query.warehouseId,
    page: 1,
    pageSize: 5000,
  });
  return list.rows;
}

export interface AuditListQuery {
  from?: string;
  to?: string;
  range?: string;
  actorId?: string;
  action?: string;
  resource?: string;
  page?: string;
  pageSize?: string;
}

export async function getAuditReport(
  user: UserWithPermissions,
  query: AuditListQuery
): Promise<{
  rows: reportRepo.AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  if (!userHasAny(user, AUDIT_READ)) {
    return { rows: [], total: 0, page: 1, pageSize: 20 };
  }
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));

  return reportRepo.getAuditList(
    {
      from,
      to,
      actorId: query.actorId,
      action: query.action,
      resource: query.resource,
      page,
      pageSize,
    }
  );
}

export async function getAuditExport(
  user: UserWithPermissions,
  query: Omit<AuditListQuery, 'page' | 'pageSize'>
): Promise<reportRepo.AuditRow[]> {
  if (!userHasAny(user, AUDIT_READ) && !userHasAny(user, EXPORT_READ)) return [];
  const { from, to } = parseReportDateRange(query.range, query.from, query.to);
  const list = await reportRepo.getAuditList({
    from,
    to,
    actorId: query.actorId,
    action: query.action,
    resource: query.resource,
    page: 1,
    pageSize: 5000,
  });
  return list.rows;
}

export async function getInventoryExport(
  user: UserWithPermissions,
  query: Omit<InventoryListQuery, 'page' | 'pageSize'>
): Promise<reportRepo.InventoryRow[]> {
  if (!userHasAny(user, EXPORT_READ) && !userHasAny(user, INVENTORY_READ)) return [];
  const sort = (['name', 'sku', 'onHand', 'stockValue', 'category'] as const).includes(query.sort as 'name')
    ? (query.sort as reportRepo.InventoryListParams['sort'])
    : 'name';
  const order = query.order === 'asc' ? 'asc' : 'desc';
  const result = await reportRepo.getInventoryList({
    warehouseId: query.warehouseId,
    category: query.category,
    q: query.q,
    lowStockOnly: query.lowStockOnly,
    page: 1,
    pageSize: 5000,
    sort,
    order,
  });
  return result.rows;
}
