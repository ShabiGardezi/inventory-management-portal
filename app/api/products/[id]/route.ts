import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  unit: z.string().max(50).optional(),
  price: z.number().positive().optional().nullable(),
  reorderLevel: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  trackBatches: z.boolean().optional(),
  trackSerials: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('product:read');
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      return createErrorResponse('Product not found', 404);
    }
    return createSuccessResponse(product);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('GET /api/products/[id] error:', error);
    return createErrorResponse('Failed to load product', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('product:update');
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const data = parsed.data;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return createErrorResponse('Product not found', 404);
    }
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.reorderLevel !== undefined && { reorderLevel: data.reorderLevel }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.trackBatches !== undefined && { trackBatches: data.trackBatches }),
        ...(data.trackSerials !== undefined && { trackSerials: data.trackSerials }),
      },
    });
    revalidateTag('products');
    revalidateTag('dashboard');
    return createSuccessResponse(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('PATCH /api/products/[id] error:', error);
    return createErrorResponse('Failed to update product', 500);
  }
}

/** Soft delete: set isActive = false so product is excluded from active lists; history remains. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('product:delete');
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return createErrorResponse('Product not found', 404);
    }
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    revalidateTag('products');
    revalidateTag('dashboard');
    return createSuccessResponse({ message: 'Product deleted (archived).' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('DELETE /api/products/[id] error:', error);
    return createErrorResponse('Failed to delete product', 500);
  }
}
