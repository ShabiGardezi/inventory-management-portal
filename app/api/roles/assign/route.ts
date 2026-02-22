import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/server/services/userService';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const bodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  roleIds: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission('roles.assign');
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const { userId, roleIds } = parsed.data;
    const service = new UserService(prisma);
    await service.assignRoles(userId, roleIds, actor.id);
    return createSuccessResponse({
      message: 'Roles assigned successfully',
      userId,
      roleIds,
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
    console.error('POST /api/roles/assign error:', err);
    return createErrorResponse('Failed to assign roles', 500);
  }
}
