import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    await requirePermission('approvals.read');

    const { id } = await params;
    const req = await prisma.approvalRequest.findUnique({
      where: { id },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        status: true,
        requestedAt: true,
        reviewedAt: true,
        requestComment: true,
        reviewComment: true,
        metadata: true,
        requestedBy: {
          select: { id: true, email: true, name: true },
        },
        reviewedBy: {
          select: { id: true, email: true, name: true },
        },
      },
    });
    if (!req) return createErrorResponse('Approval request not found', 404);

    let entitySummary: Record<string, unknown> | null = null;
    if (req.entityType === 'PURCHASE_RECEIVE') {
      const e = await prisma.purchaseReceiveRequest.findUnique({
        where: { id: req.entityId },
        select: { id: true, referenceNumber: true, status: true, payload: true, createdAt: true },
      });
      entitySummary = e ? { referenceNumber: e.referenceNumber, status: e.status, payload: e.payload } : null;
    } else if (req.entityType === 'SALE_CONFIRM') {
      const e = await prisma.sale.findUnique({
        where: { id: req.entityId },
        select: { id: true, referenceNumber: true, status: true },
      });
      if (e) {
        const items = await prisma.saleItem.findMany({
          where: { saleId: e.id },
          select: { productId: true, warehouseId: true, quantity: true },
        });
        entitySummary = { referenceNumber: e.referenceNumber, status: e.status, items };
      } else entitySummary = null;
    } else if (req.entityType === 'STOCK_ADJUSTMENT') {
      const e = await prisma.stockAdjustment.findUnique({
        where: { id: req.entityId },
        select: { id: true, productId: true, warehouseId: true, method: true, quantity: true, newQuantity: true, reason: true, status: true },
      });
      entitySummary = e ? { ...e } : null;
    } else if (req.entityType === 'STOCK_TRANSFER') {
      const e = await prisma.stockTransfer.findUnique({
        where: { id: req.entityId },
        select: { id: true, productId: true, fromWarehouseId: true, toWarehouseId: true, quantity: true, notes: true, status: true },
      });
      entitySummary = e ? { ...e, quantity: e.quantity.toString() } : null;
    }

    return createSuccessResponse({
      ...req,
      entitySummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch approval';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
