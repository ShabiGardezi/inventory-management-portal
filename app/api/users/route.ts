import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/server/services/userService';
import {
  requirePermission,
  hasPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const querySchema = z.object({
  q: z.string().optional(),
  roleId: z.string().optional(),
  status: z.enum(['active', 'disabled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission('users.read');
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: searchParams.get('q') ?? undefined,
      roleId: searchParams.get('roleId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
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
    const { q, roleId, status, page, pageSize, sort, order } = parsed.data;
    const service = new UserService(prisma);
    const result = await service.listUsers(
      { q, roleId, status },
      page,
      pageSize,
      sort,
      order
    );
    return createSuccessResponse({
      rows: result.rows,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    console.error('GET /api/users error:', err);
    return createErrorResponse('Failed to fetch users', 500);
  }
}

const createBodySchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().max(255).optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleIds: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission('users.create');
    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }
    const { email, name, password, roleIds } = parsed.data;
    if (roleIds.length > 0 && !hasPermission(actor, 'roles.assign')) {
      return createErrorResponse('Forbidden: roles.assign required to assign roles', 403);
    }
    const service = new UserService(prisma);
    const user = await service.createUser(
      { email, name: name ?? undefined, password, roleIds },
      actor.id
    );
    return createSuccessResponse(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      },
      201
    );
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
    console.error('POST /api/users error:', err);
    return createErrorResponse('Failed to create user', 500);
  }
}
