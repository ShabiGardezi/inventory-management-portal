import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const bulkDeleteSchema = z.object({
  productIds: z
    .array(z.string().min(1))
    .min(1, 'At least one product is required')
    .max(500, 'Cannot delete more than 500 products at once'),
});

/** Soft delete multiple products in a transaction. */
export async function POST(request: NextRequest) {
  try {
    await requirePermission('product:delete');
    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const { productIds } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { isActive: false },
      });
      return { deletedCount: updated.count };
    });

    revalidateTag('products');
    revalidateTag('dashboard');
    return createSuccessResponse({
      message: 'Products deleted (archived).',
      deletedCount: result.deletedCount,
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
    console.error('POST /api/products/bulk-delete error:', error);
    return createErrorResponse('Failed to delete products', 500);
  }
}
