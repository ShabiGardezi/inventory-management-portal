import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getInventoryReport } from '@/server/services/reportService';

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
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      categoryId: searchParams.get('categoryId') ?? undefined,
      category: searchParams.get('category') ?? searchParams.get('categoryId') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      lowStockOnly: searchParams.get('lowStockOnly') === 'true',
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    };
    const result = await getInventoryReport(user, query);
    const res = createSuccessResponse({
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
    console.error('GET /api/reports/inventory error:', error);
    return createErrorResponse('Failed to load inventory report', 500);
  }
}
