import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WarehouseService } from '@/server/services/warehouse.service';
import {
  requireAnyPermission,
  createErrorResponse,
} from '@/lib/rbac';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAnyPermission(['warehouse:read', 'reports:read']);

    const { id } = await params;
    const service = new WarehouseService(prisma);
    const warehouse = await service.getWarehouseById(id);
    if (!warehouse) {
      return createErrorResponse('Warehouse not found', 404);
    }

    const csv = await service.exportStockCsv(id);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="warehouse-${id}-stock.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
