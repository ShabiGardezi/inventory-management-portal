import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { getDistinctCategories } from '@/server/repositories/reportRepo';

const REPORTS_FILTERS_MAX_AGE = 60;

export async function GET() {
  try {
    await requireAnyPermission(['reports.read', 'reports:read']);
    const [warehouses, categories] = await Promise.all([
      prisma.warehouse.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      getDistinctCategories(),
    ]);
    const res = createSuccessResponse({
      warehouses: warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code })),
      categories,
    });
    res.headers.set('Cache-Control', `private, max-age=${REPORTS_FILTERS_MAX_AGE}, stale-while-revalidate=120`);
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
    console.error('GET /api/reports/filters error:', error);
    return createErrorResponse('Failed to load report filters', 500);
  }
}
