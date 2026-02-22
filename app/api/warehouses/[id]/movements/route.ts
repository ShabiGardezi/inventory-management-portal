import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WarehouseService } from '@/server/services/warehouse.service';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAnyPermission(['warehouse:read', 'inventory:read']);

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const type = searchParams.get('type') ?? undefined;
    const productId = searchParams.get('productId') ?? undefined;
    const dateFrom = searchParams.get('dateFrom') ?? undefined;
    const dateTo = searchParams.get('dateTo') ?? undefined;

    const service = new WarehouseService(prisma);
    const result = await service.getWarehouseMovements(id, {
      page,
      limit,
      type,
      productId,
      dateFrom,
      dateTo,
    });

    return createSuccessResponse({
      rows: result.rows,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch movements';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
