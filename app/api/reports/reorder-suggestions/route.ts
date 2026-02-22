import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getReorderSuggestionsReport } from '@/server/services/reportService';

const REPORTS_DATA_MAX_AGE = 20;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission([
      'reports.read',
      'reports:read',
      'inventory.read',
      'inventory:read',
    ]);
    const { searchParams } = new URL(request.url);
    const query = {
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      productId: searchParams.get('productId') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      lowDaysOnly: searchParams.get('lowDaysOnly') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    };
    const result = await getReorderSuggestionsReport(user, query);
    const res = createSuccessResponse({
      rows: result.rows.map((r) => ({
        ...r,
        predictedStockoutDate: r.predictedStockoutDate?.toISOString() ?? null,
      })),
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
    console.error('GET /api/reports/reorder-suggestions error:', error);
    return createErrorResponse('Failed to load reorder suggestions report', 500);
  }
}
