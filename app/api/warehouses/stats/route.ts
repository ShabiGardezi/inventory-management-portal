import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WarehouseService } from '@/server/services/warehouse.service';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

export async function GET(_request: NextRequest) {
  try {
    await requirePermission('warehouse:read');

    const service = new WarehouseService(prisma);
    const stats = await service.getAggregateStats();

    return createSuccessResponse(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch stats';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
