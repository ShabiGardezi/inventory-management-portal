import type { UserWithPermissions } from '@/lib/rbac';
import {
  hasPermission,
  hasRole,
} from '@/lib/rbac';
import * as repo from '@/server/repositories/dashboardRepo';

export type DashboardRange = '7d' | '30d' | '90d' | 'custom';

function parseRange(range: string): number {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return 30;
  }
}

function parseDateRange(from: string | null, to: string | null): { start: Date; end: Date } | null {
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start > end) return null;
  const maxDays = 365;
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (days > maxDays) return null;
  return { start, end };
}

export interface DashboardSummary {
  totalProducts?: number;
  totalWarehouses?: number;
  totalStockValue?: number;
  lowStockCount?: number;
  todaySalesTotal?: number;
  todayPurchasesTotal?: number;
  todaySalesQuantity?: number;
  todayPurchasesQuantity?: number;
  transfersThisWeek?: number;
  myRecentMovementsCount?: number;
}

export interface DashboardCharts {
  movementTrend?: { date: string; in: number; out: number }[];
  salesVsPurchases?: { date: string; sales: number; purchases: number }[];
  lowStockByCategory?: { category: string; count: number }[];
  stockByCategory?: { category: string; quantity: number }[];
  myMovementsTrend?: { date: string; count: number }[];
}

export interface DashboardTables {
  lowStock?: Awaited<ReturnType<typeof repo.getLowStockProducts>>;
  likelyToStockOut?: Awaited<ReturnType<typeof repo.getLikelyToStockOut>>;
  recentMovements?: Awaited<ReturnType<typeof repo.getRecentMovements>>;
  recentSales?: Awaited<ReturnType<typeof repo.getRecentSales>>;
  recentPurchases?: Awaited<ReturnType<typeof repo.getRecentPurchases>>;
  auditLogs?: Awaited<ReturnType<typeof repo.getRecentAuditLogs>>;
}

export interface DashboardData {
  summary: DashboardSummary;
  charts: DashboardCharts;
  tables: DashboardTables;
  range: DashboardRange;
}

const PREVIEW_LIMIT = 5;

/**
 * Returns dashboard data scoped to the current user's permissions and role.
 * Admin: full summary, all charts, all tables.
 * Manager: summary (no user counts), movement/sales/purchases charts and tables, no audit.
 * Staff: low stock, my movements count, movements chart (my or overall by permission), low stock + movements + sales if allowed.
 * Viewer: products, warehouses, low stock count, stock by category chart, low stock + recent movements tables only.
 */
export interface DashboardDataOptions {
  from?: string | null;
  to?: string | null;
}

export async function getDashboardData(
  user: UserWithPermissions,
  range: DashboardRange,
  limit: number = PREVIEW_LIMIT,
  options?: DashboardDataOptions
): Promise<DashboardData> {
  const customRange = range === 'custom' ? parseDateRange(options?.from ?? null, options?.to ?? null) : null;
  const days = customRange
    ? Math.ceil((customRange.end.getTime() - customRange.start.getTime()) / 86400000) + 1
    : parseRange(range);
  const summary: DashboardSummary = {};
  const charts: DashboardCharts = {};
  const tables: DashboardTables = {};

  const canProductRead = hasPermission(user, 'product:read');
  const canWarehouseRead = hasPermission(user, 'warehouse:read');
  const canStockRead = hasPermission(user, 'stock:read');
  const canAuditRead = hasPermission(user, 'audit:read');

  const isAdmin = hasRole(user, 'admin');
  const isManager = hasRole(user, 'manager');
  const isStaff = hasRole(user, 'staff');
  const isViewer = hasRole(user, 'viewer');

  // --- Summary cards ---
  if (canProductRead) {
    summary.totalProducts = await repo.getTotalProducts();
    summary.lowStockCount = await repo.getLowStockCount();
  }
  if (canWarehouseRead) {
    summary.totalWarehouses = await repo.getTotalWarehouses();
  }

  if (isAdmin) {
    summary.totalStockValue = await repo.getTotalStockValue();
    summary.todaySalesTotal = await repo.getTodaySalesTotal();
    summary.todayPurchasesTotal = await repo.getTodayPurchasesTotal();
  }
  if (isManager) {
    summary.transfersThisWeek = await repo.getTransfersThisWeek();
    summary.todaySalesTotal = summary.todaySalesTotal ?? await repo.getTodaySalesTotal();
    summary.todayPurchasesTotal = summary.todayPurchasesTotal ?? await repo.getTodayPurchasesTotal();
  }
  if (isStaff) {
    summary.myRecentMovementsCount = await repo.getMyRecentMovementsCount(user.id);
    if (canStockRead) {
      summary.todaySalesQuantity = summary.todaySalesQuantity ?? await repo.getTodaySalesQuantity();
    }
  }

  // --- Charts ---
  if (canStockRead) {
    if (isAdmin || isManager) {
      if (customRange) {
        charts.movementTrend = await repo.getMovementTrendByRange(customRange.start, customRange.end);
        charts.salesVsPurchases = await repo.getSalesVsPurchasesTrendByRange(customRange.start, customRange.end);
      } else {
        charts.movementTrend = await repo.getMovementTrend(days);
        charts.salesVsPurchases = await repo.getSalesVsPurchasesTrend(days);
      }
    }
    if (isAdmin || isManager) {
      charts.lowStockByCategory = await repo.getLowStockByCategory();
    }
    if (isStaff) {
      if (customRange) {
        charts.myMovementsTrend = await repo.getMyMovementsTrendByRange(user.id, customRange.start, customRange.end);
      } else {
        charts.myMovementsTrend = await repo.getMyMovementsTrend(user.id, Math.min(days, 14));
      }
    }
    if (isViewer) {
      charts.stockByCategory = await repo.getStockByCategory();
    }
  }

  // --- Preview tables ---
  if (canProductRead && summary.lowStockCount !== undefined) {
    tables.lowStock = await repo.getLowStockProducts(limit);
  }
  if (canStockRead) {
    tables.likelyToStockOut = await repo.getLikelyToStockOut(limit);
    tables.recentMovements = await repo.getRecentMovements(limit);
    if (isAdmin || isManager) {
      tables.recentSales = await repo.getRecentSales(limit);
      tables.recentPurchases = await repo.getRecentPurchases(limit);
    }
    if (isStaff && hasPermission(user, 'stock:read')) {
      tables.recentSales = tables.recentSales ?? await repo.getRecentSales(limit);
    }
  }
  if (canAuditRead && (isAdmin || isManager)) {
    tables.auditLogs = await repo.getRecentAuditLogs(limit);
  }

  return {
    summary,
    charts,
    tables,
    range,
  };
}
