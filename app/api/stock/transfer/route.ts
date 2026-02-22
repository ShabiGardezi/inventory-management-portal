import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { StockService } from '@/server/services';
import { getInventoryRules } from '@/server/services/settingsService';

const transferSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  fromWarehouseId: z.string().min(1, 'Source warehouse is required'),
  toWarehouseId: z.string().min(1, 'Destination warehouse is required'),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().max(500).optional(),
  allowNegative: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('stock:transfer');
    const body = await request.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const data = parsed.data;

    if (data.fromWarehouseId === data.toWarehouseId) {
      return createErrorResponse('Source and destination warehouses must be different', 400);
    }

    let allowNegative = data.allowNegative;
    if (allowNegative === undefined) {
      try {
        const rules = await getInventoryRules();
        allowNegative = rules?.allowNegativeStock ?? false;
      } catch {
        allowNegative = false;
      }
    }

    // Ensure createdById exists in users table (avoids FK violation if session id is stale)
    let createdById: string | undefined = user.id;
    if (createdById) {
      const userExists = await prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
      if (!userExists) createdById = undefined;
    }

    const stockService = new StockService(prisma);
    const result = await stockService.transferStock({
      productId: data.productId,
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      quantity: data.quantity,
      notes: data.notes,
      createdById,
      allowNegative,
    });

    return createSuccessResponse(result, 201);
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
        error.message.includes('Insufficient stock') ||
        error.message.includes('must be different')
      ) {
        return createErrorResponse(error.message, 400);
      }
    }
    console.error('POST /api/stock/transfer error:', error);
    return createErrorResponse('Failed to transfer stock', 500);
  }
}
