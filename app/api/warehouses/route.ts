import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { WarehouseService } from '@/server/services/warehouse.service';
import {
  requirePermission,
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission('warehouse:read');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const search = searchParams.get('search') ?? undefined;
    const status = searchParams.get('status') as 'active' | 'inactive' | undefined;
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
    const sortBy = searchParams.get('sortBy') ?? 'name';
    const sortDir = (searchParams.get('sortDir') ?? 'asc') as 'asc' | 'desc';

    const service = new WarehouseService(prisma);
    const filters = { search, status, lowStockOnly };
    const result = await service.listWarehouses(filters, page, limit, sortBy, sortDir);

    return createSuccessResponse({
      list: result.list,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch warehouses';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission('warehouse:create');

    const body = await request.json();
    const parsed = createWarehouseSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    const service = new WarehouseService(prisma);
    const warehouse = await service.createWarehouse(parsed.data);

    return createSuccessResponse({ message: 'Warehouse created', warehouse }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create warehouse';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    if (message.includes('already exists')) return createErrorResponse(message, 409);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
