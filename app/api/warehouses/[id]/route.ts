import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { WarehouseService } from '@/server/services/warehouse.service';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('warehouse:read');

    const { id } = await params;
    const service = new WarehouseService(prisma);
    const warehouse = await service.getWarehouseById(id);

    if (!warehouse) {
      return createErrorResponse('Warehouse not found', 404);
    }

    return createSuccessResponse(warehouse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch warehouse';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('warehouse:update');

    const { id } = await params;
    const body = await request.json();
    const parsed = updateWarehouseSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    const service = new WarehouseService(prisma);
    const warehouse = await service.updateWarehouse(id, parsed.data);

    return createSuccessResponse({ message: 'Warehouse updated', warehouse });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update warehouse';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    if (message === 'Warehouse not found') return createErrorResponse(message, 404);
    if (message.includes('already exists')) return createErrorResponse(message, 409);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
