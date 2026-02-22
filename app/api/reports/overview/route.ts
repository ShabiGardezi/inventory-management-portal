import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getReportOverview } from '@/server/services/reportService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission(['reports.read', 'reports:read']);
    const { searchParams } = new URL(request.url);
    const filters = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      category: searchParams.get('categoryId') ?? undefined,
    };
    const data = await getReportOverview(user, filters);
    return createSuccessResponse(data);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('GET /api/reports/overview error:', error);
    return createErrorResponse('Failed to load report overview', 500);
  }
}
