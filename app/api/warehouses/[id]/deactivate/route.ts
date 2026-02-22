import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WarehouseService } from '@/server/services/warehouse.service';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('warehouse:delete');

    const { id } = await params;
    const service = new WarehouseService(prisma);
    const warehouse = await service.deactivateWarehouse(id);

    return createSuccessResponse({ message: 'Warehouse deactivated', warehouse });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate warehouse';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    if (message === 'Warehouse not found') return createErrorResponse(message, 404);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
