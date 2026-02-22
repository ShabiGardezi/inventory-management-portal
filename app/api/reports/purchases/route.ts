import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getPurchasesReport } from '@/server/services/reportService';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission([
      'reports.read',
      'reports:read',
      'purchase.read',
      'purchase:read',
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
    const result = await getPurchasesReport(user, query);
    return createSuccessResponse({
      totals: result.totals,
      trend: result.trend,
      byWarehouse: result.byWarehouse,
      rows: result.rows,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize) || 1,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('GET /api/reports/purchases error:', error);
    return createErrorResponse('Failed to load purchases report', 500);
  }
}
