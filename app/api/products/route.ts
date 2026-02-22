import { NextRequest } from 'next/server';
import { revalidateTag, unstable_cache } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const PRODUCTS_LIST_REVALIDATE_SECONDS = 30;

// Zod schema for product creation
const createProductSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU must be 100 characters or less')
    .regex(/^[A-Z0-9\-_]+$/, 'SKU must contain only uppercase letters, numbers, hyphens, and underscores'),
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(255, 'Product name must be 255 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  category: z.string().max(100, 'Category must be 100 characters or less').optional(),
  unit: z.string().max(50, 'Unit must be 50 characters or less').default('pcs'),
  price: z
    .number()
    .positive('Price must be a positive number')
    .optional()
    .nullable(),
  reorderLevel: z.number().int().min(0, 'Reorder level must be 0 or more').optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication and permission
    const user = await requirePermission('product:create');

    // 2. Parse and validate request body
    const body = await request.json();
    
    const validationResult = createProductSchema.safeParse(body);
    
    if (!validationResult.success) {
      return createErrorResponse(
        `Validation error: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    const data = validationResult.data;

    // 3. Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existingProduct) {
      return createErrorResponse(
        `Product with SKU '${data.sku}' already exists`,
        409
      );
    }

    // 4. Create the product
    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        unit: data.unit,
        price: data.price ?? null,
        reorderLevel: data.reorderLevel ?? null,
        isActive: data.isActive,
      },
    });

    // 5. Log the action (optional - you can create an audit log here)
    // await prisma.auditLog.create({
    //   data: {
    //     userId: user.id,
    //     action: 'CREATE',
    //     resource: 'product',
    //     resourceId: product.id,
    //     description: `Created product: ${product.name} (${product.sku})`,
    //   },
    // });

    revalidateTag('products');
    revalidateTag('dashboard');
    return createSuccessResponse(
      {
        message: 'Product created successfully',
        product,
      },
      201
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized: Authentication required', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return createErrorResponse(
        'A product with this SKU already exists',
        409
      );
    }
    console.error('Error creating product:', error);
    return createErrorResponse(
      'Internal server error: Failed to create product',
      500
    );
  }
}

// GET endpoint example (with permission check)
export async function GET(request: NextRequest) {
  try {
    await requirePermission('product:read');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const isActive = searchParams.get('isActive') ?? '';
    const filterLowStock = searchParams.get('filter') === 'low-stock';

    const getCachedProducts = unstable_cache(
      async () => {
        const skip = (page - 1) * limit;
        const where: Record<string, unknown> = {};

        if (filterLowStock) {
          const balances = await prisma.stockBalance.groupBy({
            by: ['productId'],
            _sum: { available: true },
          });
          const lowStockProductIds = balances
            .filter((b) => {
              const total = Number(b._sum.available ?? 0);
              return total < 10 && total >= 0;
            })
            .map((b) => b.productId);
          where.id = { in: lowStockProductIds };
        }

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ];
        }

        if (category) {
          where.category = category;
        }

        if (isActive !== null && isActive !== undefined && isActive !== '') {
          where.isActive = isActive === 'true';
        } else {
          where.isActive = true;
        }

        const [products, total] = await Promise.all([
          prisma.product.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.product.count({ where }),
        ]);

        return { products, total, page, limit };
      },
      ['products', String(page), String(limit), search, category, isActive, String(filterLowStock)],
      { revalidate: PRODUCTS_LIST_REVALIDATE_SECONDS, tags: ['products'] }
    );

    const { products, total, page: p, limit: l } = await getCachedProducts();
    const res = createSuccessResponse({
      products,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
      },
    });
    res.headers.set('Cache-Control', 'private, max-age=20, stale-while-revalidate=40');
    return res;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized: Authentication required', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('Error fetching products:', error);
    return createErrorResponse(
      'Internal server error: Failed to fetch products',
      500
    );
  }
}
