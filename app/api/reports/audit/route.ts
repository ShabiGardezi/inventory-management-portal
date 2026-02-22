import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getAuditReport } from '@/server/services/reportService';

const REPORTS_DATA_MAX_AGE = 20;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission(['audit.read', 'audit:read']);
    const { searchParams } = new URL(request.url);
    const query = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      actorId: searchParams.get('actorId') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      resource: searchParams.get('resource') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    };
    const result = await getAuditReport(user, query);
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
    console.error('GET /api/reports/audit error:', error);
    return createErrorResponse('Failed to load audit report', 500);
  }
}
