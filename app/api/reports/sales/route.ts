import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getSalesReport } from '@/server/services/reportService';

const REPORTS_DATA_MAX_AGE = 20;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission([
      'reports.read',
      'reports:read',
      'sales.read',
      'sales:read',
    ]);
    const { searchParams } = new URL(request.url);
    const query = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    };
    const result = await getSalesReport(user, query);
    const res = createSuccessResponse({
      totals: result.totals,
      trend: result.trend,
      topProducts: result.topProducts,
      rows: result.rows,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize) || 1,
      },
    });
    res.headers.set('Cache-Control', `private, max-age=${REPORTS_DATA_MAX_AGE}, stale-while-revalidate=40`);
    return res;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('GET /api/reports/sales error:', error);
    return createErrorResponse('Failed to load sales report', 500);
  }
}
