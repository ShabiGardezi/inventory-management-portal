import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { getDistinctCategories } from '@/server/repositories/reportRepo';

export const dynamic = 'force-dynamic';

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
    return createSuccessResponse({
      warehouses: warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code })),
      categories,
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
    console.error('GET /api/reports/filters error:', error);
    return createErrorResponse('Failed to load report filters', 500);
  }
}
