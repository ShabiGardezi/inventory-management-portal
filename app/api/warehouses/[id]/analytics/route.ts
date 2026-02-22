import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WarehouseService } from '@/server/services/warehouse.service';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('warehouse:read');

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') ?? '30', 10)));
    const topLimit = Math.min(20, Math.max(1, parseInt(searchParams.get('topLimit') ?? '10', 10)));

    const service = new WarehouseService(prisma);
    const [movementTrend, topMovedProducts] = await Promise.all([
      service.getMovementTrend(id, days),
      service.getTopMovedProducts(id, days, topLimit),
    ]);

    return createSuccessResponse({ movementTrend, topMovedProducts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
