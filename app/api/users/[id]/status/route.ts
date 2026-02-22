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
  isActive: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission('users.disable');
    const { id } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const service = new UserService(prisma);
    const result = await service.setUserStatus(id, parsed.data.isActive, actor.id);
    return createSuccessResponse({
      message: result.isActive ? 'User enabled' : 'User disabled',
      user: { id: result.id, isActive: result.isActive },
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
    console.error('PATCH /api/users/[id]/status error:', err);
    return createErrorResponse('Failed to update user status', 500);
  }
}
