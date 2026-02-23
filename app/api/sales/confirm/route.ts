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

const confirmItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().positive('Quantity must be positive'),
  batchId: z.string().optional().nullable(),
  serialNumbers: z.array(z.string()).optional().nullable(),
});

const confirmSchema = z.object({
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(confirmItemSchema).min(1, 'At least one item is required'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('stock:adjust');
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
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

    const needsApproval = await isApprovalRequired(prisma, 'SALE_CONFIRM');
    if (needsApproval) {
      const sale = await prisma.sale.create({
        data: {
          referenceNumber: data.referenceNumber ?? null,
          status: 'PENDING_APPROVAL',
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              warehouseId: i.warehouseId,
              quantity: i.quantity,
            })),
          },
        },
        select: { id: true },
      });
      const approval = await requestApproval(prisma, {
        entityType: 'SALE_CONFIRM',
        entityId: sale.id,
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
          message: 'Sale confirm submitted for approval',
          requestId: approval.id,
          entityId: sale.id,
        },
        202
      );
    }

    const stockService = new StockService(prisma);
    const results: Array<{ success: boolean; message?: string }> = [];

    for (const item of data.items) {
      try {
        await stockService.confirmSale({
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          createdById,
          batchId: item.batchId ?? undefined,
          serialNumbers: item.serialNumbers ?? undefined,
        });
        results.push({ success: true });
      } catch (err) {
        results.push({
          success: false,
          message: err instanceof Error ? err.message : 'Confirm failed',
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
        itemsConfirmed: data.items.length,
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
        error.message.includes('Insufficient') ||
        error.message.includes('required') ||
        error.message.includes('Serial')
      ) {
        return createErrorResponse(error.message, 400);
      }
    }
    return createErrorResponse('Failed to confirm sale', 500);
  }
}