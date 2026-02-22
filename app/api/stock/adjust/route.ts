import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { StockService } from '@/server/services';
import { getInventoryRules } from '@/server/services/settingsService';

const adjustSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  method: z.enum(['increase', 'decrease', 'set']),
  quantity: z.number().positive().optional(),
  newQuantity: z.number().min(0).optional(),
  reason: z.enum(['damage', 'recount', 'correction', 'opening_stock']),
  notes: z.string().max(500).optional(),
  allowNegative: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('stock:adjust');
    const body = await request.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const data = parsed.data;

    if (data.method !== 'set' && (data.quantity == null || data.quantity <= 0)) {
      return createErrorResponse('Quantity is required and must be positive for increase/decrease', 400);
    }
    if (data.method === 'set' && (data.newQuantity == null || data.newQuantity < 0)) {
      return createErrorResponse('New quantity is required for set to exact', 400);
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
    const result = await stockService.adjustStock({
      productId: data.productId,
      warehouseId: data.warehouseId,
      method: data.method,
      quantity: data.quantity,
      newQuantity: data.newQuantity,
      reason: data.reason,
      notes: data.notes,
      createdById,
      allowNegative,
    });

    revalidateTag('dashboard');
    revalidateTag('stock-movements');
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
        error.message.includes('Insufficient stock')
      ) {
        return createErrorResponse(error.message, 400);
      }
      console.error('POST /api/stock/adjust error:', error);
      return createErrorResponse(
        process.env.NODE_ENV === 'development' ? error.message : 'Failed to adjust stock',
        500
      );
    }
    console.error('POST /api/stock/adjust error:', error);
    return createErrorResponse('Failed to adjust stock', 500);
  }
}
