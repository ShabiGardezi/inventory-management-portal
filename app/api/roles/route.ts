import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { RoleService } from '@/server/services/roleService';
import {
  requirePermission,
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const querySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(['name', 'updatedAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const createBodySchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(['roles.read', 'roles.manage']);
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    });
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const { search, page, pageSize, sort, order } = parsed.data;
    const service = new RoleService(prisma);
    const result = await service.listRoles(search, page, pageSize, sort, order);
    return createSuccessResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    console.error('GET /api/roles error:', err);
    return createErrorResponse('Failed to fetch roles', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('roles.manage');
    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const service = new RoleService(prisma);
    const role = await service.createRole(parsed.data, user.id);
    return createSuccessResponse(role, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    if (message.includes('already exists')) {
      return createErrorResponse(message, 409);
    }
    console.error('POST /api/roles error:', err);
    return createErrorResponse('Failed to create role', 500);
  }
}
