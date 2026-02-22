import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { InventoryMetricsService } from '@/server/services';

export async function POST(request: NextRequest) {
  try {
    await requirePermission('stock:adjust');

    const body = await request.json().catch(() => ({}));
    const lookbackDays =
      typeof body.lookbackDays === 'number' ? body.lookbackDays : undefined;
    const onlyWithPolicy =
      typeof body.onlyWithPolicy === 'boolean' ? body.onlyWithPolicy : undefined;
    const concurrency =
      typeof body.concurrency === 'number' ? body.concurrency : undefined;

    const metricsService = new InventoryMetricsService(prisma);
    const result = await metricsService.recomputeAllMetrics({
      lookbackDays,
      onlyWithPolicy,
      concurrency,
    });

    revalidateTag('dashboard');
    revalidateTag('reports');
    return createSuccessResponse(
      { computed: result.computed, message: `Recalculated ${result.computed} metric(s).` },
      200
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    return createErrorResponse('Failed to recompute metrics', 500);
  }
}
