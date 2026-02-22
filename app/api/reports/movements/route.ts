import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getMovementsReport } from '@/server/services/reportService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission([
      'reports.read',
      'reports:read',
      'inventory.read',
      'inventory:read',
      'stock:read',
    ]);
    const { searchParams } = new URL(request.url);
    const query = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      referenceType: searchParams.get('referenceType') ?? undefined,
      performedBy: searchParams.get('performedBy') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    };
    const result = await getMovementsReport(user, query);
    return createSuccessResponse({
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
    console.error('GET /api/reports/movements error:', error);
    return createErrorResponse('Failed to load movements report', 500);
  }
}
