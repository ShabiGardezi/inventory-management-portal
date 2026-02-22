import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import {
  StockService,
  InventoryMetricsService,
  isApprovalRequired,
  requestApproval,
} from '@/server/services';

const batchInputSchema = z.object({
  batchNumber: z.string().min(1, 'Batch number is required'),
  expiryDate: z.string().optional().nullable(),
  mfgDate: z.string().optional().nullable(),
});

const receiveItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().optional(),
  batchInput: batchInputSchema.optional().nullable(),
  batchId: z.string().optional().nullable(),
  serialNumbers: z.array(z.string()).optional().nullable(),
});

const receiveSchema = z.object({
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(receiveItemSchema).min(1, 'At least one item is required'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('stock:adjust');
    const body = await request.json();
    const parsed = receiveSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createErrorResponse(`Validation error: ${msg}`, 400);
    }
    const data = parsed.data;

    let createdById: string | undefined = user.id;
    if (createdById) {
      const userExists = await prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
      if (!userExists) createdById = undefined;
    }

    const needsApproval = await isApprovalRequired(prisma, 'PURCHASE_RECEIVE', {
      minAmount: data.items.reduce((sum, i) => sum + (i.quantity * (i.unitCost ?? 0)), 0) || undefined,
    });
    if (needsApproval) {
      const receiveRequest = await prisma.purchaseReceiveRequest.create({
        data: {
          referenceNumber: data.referenceNumber ?? null,
          notes: data.notes ?? null,
          status: 'PENDING_APPROVAL',
          requestedById: createdById ?? null,
          payload: { items: data.items },
        },
        select: { id: true },
      });
      const approval = await requestApproval(prisma, {
        entityType: 'PURCHASE_RECEIVE',
        entityId: receiveRequest.id,
        requestedBy: user.id,
        requestComment: data.notes ?? undefined,
        metadata: {
          referenceNumber: data.referenceNumber,
          itemCount: data.items.length,
          totalQuantity: data.items.reduce((s, i) => s + i.quantity, 0),
        },
      });
      revalidateTag('dashboard');
      revalidateTag('stock-movements');
      return createSuccessResponse(
        {
          pendingApproval: true,
          message: 'Receive submitted for approval',
          requestId: approval.id,
          entityId: receiveRequest.id,
        },
        202
      );
    }

    const stockService = new StockService(prisma);
    const results: Array<{ success: boolean; message?: string }> = [];
    let batchesCreated = 0;
    let serialsCreated = 0;

    for (const item of data.items) {
      const batchInput =
        item.batchInput?.batchNumber != null
          ? {
              batchNumber: item.batchInput.batchNumber,
              expiryDate: item.batchInput.expiryDate ? new Date(item.batchInput.expiryDate) : undefined,
              mfgDate: item.batchInput.mfgDate ? new Date(item.batchInput.mfgDate) : undefined,
            }
          : undefined;

      try {
        await stockService.receivePurchase({
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          createdById,
          batchId: item.batchId ?? undefined,
          batchInput: batchInput ?? undefined,
          serialNumbers: item.serialNumbers ?? undefined,
        });
        results.push({ success: true });
        if (batchInput) batchesCreated += 1;
        if (item.serialNumbers?.length) serialsCreated += item.serialNumbers.length;
      } catch (err) {
        results.push({
          success: false,
          message: err instanceof Error ? err.message : 'Receive failed',
        });
      }
    }

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      return createErrorResponse(
        failed.map((f) => f.message).join('; ') || 'Some items failed',
        400
      );
    }

    const metricsService = new InventoryMetricsService(prisma);
    const pairs = Array.from(
      new Map(data.items.map((i) => [`${i.productId}:${i.warehouseId}`, { productId: i.productId, warehouseId: i.warehouseId }])).values()
    );
    await Promise.all(pairs.map((p) => metricsService.recomputeForProductWarehouse(p.productId, p.warehouseId)));

    revalidateTag('dashboard');
    revalidateTag('stock-movements');
    return createSuccessResponse(
      {
        itemsReceived: data.items.length,
        batchesCreated,
        serialsCreated,
      },
      201
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
      if (
        error.message.includes('not found') ||
        error.message.includes('required') ||
        error.message.includes('Batch') ||
        error.message.includes('Serial')
      ) {
        return createErrorResponse(error.message, 400);
      }
    }
    return createErrorResponse('Failed to receive purchase', 500);
  }
}
