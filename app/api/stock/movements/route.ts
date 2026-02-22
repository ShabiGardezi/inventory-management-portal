import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getMovementsList, type GetMovementsQuery } from '@/server/services/stockMovementService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission(['stock:read', 'inventory:read']);
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get('type');
    const typeFilter: GetMovementsQuery['type'] =
      typeParam === 'IN' || typeParam === 'OUT' || typeParam === 'TRANSFER' || typeParam === 'ADJUSTMENT'
        ? typeParam
        : undefined;
    const refTypeParam = searchParams.get('referenceType');
    const referenceType: GetMovementsQuery['referenceType'] =
      refTypeParam === 'PURCHASE' || refTypeParam === 'SALE' || refTypeParam === 'TRANSFER' || refTypeParam === 'ADJUSTMENT' || refTypeParam === 'MANUAL'
        ? refTypeParam
        : undefined;

    const query: GetMovementsQuery = {
      range: searchParams.get('range') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      productId: searchParams.get('productId') ?? undefined,
      type: typeFilter,
      referenceType,
      performedBy: searchParams.get('performedBy') ?? undefined,
      mine: searchParams.get('mine') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? searchParams.get('limit') ?? undefined,
      sort: searchParams.get('sort') === 'quantity' ? 'quantity' : searchParams.get('sort') === 'createdAt' ? 'createdAt' : undefined,
      order: searchParams.get('order') === 'asc' ? 'asc' : searchParams.get('order') === 'desc' ? 'desc' : undefined,
    };

    // Single source of truth: getMovementsList -> stockMovementRepo.listMovements (no cache)
    const result = await getMovementsList(query as GetMovementsQuery, user.id);
    const rows = result.rows.map((m) => ({
      id: m.id,
      productId: m.productId,
      warehouseId: m.warehouseId,
      movementType: m.movementType,
      quantity: m.quantity,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      referenceNumber: m.referenceNumber,
      notes: m.notes,
      createdById: m.createdById,
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : (m.createdAt as Date).toISOString(),
      product: m.product,
      warehouse: m.warehouse,
      createdBy: m.createdBy,
      batch: m.batch
        ? {
            id: m.batch.id,
            batchNumber: m.batch.batchNumber,
            expiryDate: m.batch.expiryDate instanceof Date ? m.batch.expiryDate.toISOString().slice(0, 10) : m.batch.expiryDate,
          }
        : null,
      serialCount: m.serialCount ?? null,
    }));
    return createSuccessResponse({
      rows,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
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
    console.error('GET /api/stock/movements error:', error);
    return createErrorResponse('Failed to load stock movements', 500);
  }
}
