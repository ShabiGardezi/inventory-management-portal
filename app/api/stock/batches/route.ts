import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET /api/stock/batches?productId=&warehouseId= - list batches with available qty for product+warehouse */
export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(['stock:read', 'inventory.read', 'inventory:read']);
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');

    if (!productId || !warehouseId) {
      return createErrorResponse('productId and warehouseId are required', 400);
    }

    const balances = await prisma.stockBalance.findMany({
      where: {
        productId,
        warehouseId,
        batchId: { not: null },
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            mfgDate: true,
          },
        },
      },
      orderBy: { batch: { expiryDate: 'asc' } },
    });

    const batches = balances
      .filter((b) => b.batch != null)
      .map((b) => ({
        id: b.batch!.id,
        batchNumber: b.batch!.batchNumber,
        expiryDate: b.batch!.expiryDate?.toISOString().slice(0, 10) ?? null,
        mfgDate: b.batch!.mfgDate?.toISOString().slice(0, 10) ?? null,
        availableQty: Number(b.available),
      }));

    return createSuccessResponse({ batches });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden')) {
        return createErrorResponse(error.message, 403);
      }
    }
    return createErrorResponse('Failed to list batches', 500);
  }
}
