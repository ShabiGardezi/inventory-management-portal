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

const patchBodySchema = z.object({
  name: z.string().max(255).optional().nullable(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('users.read');
    const { id } = await params;
    const service = new UserService(prisma);
    const user = await service.getUserById(id);
    if (!user) {
      return createErrorResponse('User not found', 404);
    }
    return createSuccessResponse({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((ur) => ur.role),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    console.error('GET /api/users/[id] error:', err);
    return createErrorResponse('Failed to fetch user', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission('users.update');
    const canDisable = hasPermission(actor, 'users.disable');
    const { id } = await params;
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const data = parsed.data;
    if (data.isActive !== undefined && !canDisable) {
      return createErrorResponse('Forbidden: users.disable required to change status', 403);
    }
    const service = new UserService(prisma);
    const user = await service.updateUser(id, data, actor.id, canDisable);
    return createSuccessResponse({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    if (message === 'User not found') {
      return createErrorResponse(message, 404);
    }
    console.error('PATCH /api/users/[id] error:', err);
    return createErrorResponse('Failed to update user', 500);
  }
}
