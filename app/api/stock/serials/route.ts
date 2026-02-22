import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET /api/stock/serials?productId=&warehouseId=&batchId= - list IN_STOCK serials for selection */
export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(['stock:read', 'inventory.read', 'inventory:read']);
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');
    const batchId = searchParams.get('batchId') ?? undefined;
    const statusParam = searchParams.get('status') ?? undefined;
    const status = statusParam === 'IN_STOCK' || statusParam === 'SOLD' || statusParam === 'DAMAGED' || statusParam === 'RETURNED' ? statusParam : 'IN_STOCK';

    if (!productId || !warehouseId) {
      return createErrorResponse('productId and warehouseId are required', 400);
    }

    const serials = await prisma.productSerial.findMany({
      where: {
        productId,
        warehouseId,
        status,
        ...(batchId ? { batchId } : {}),
      },
      select: { id: true, serialNumber: true },
      orderBy: { serialNumber: 'asc' },
    });

    return createSuccessResponse({
      serials: serials.map((s) => ({ id: s.id, serialNumber: s.serialNumber })),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden')) {
        return createErrorResponse(error.message, 403);
      }
    }
    return createErrorResponse('Failed to list serials', 500);
  }
}
