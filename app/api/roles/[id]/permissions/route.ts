import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { RoleService } from '@/server/services/roleService';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const bodySchema = z.object({
  permissionKeys: z.array(z.string().min(1)),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('roles.manage');
    const { id } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const service = new RoleService(prisma);
    await service.updateRolePermissions(id, parsed.data.permissionKeys, user.id);
    return createSuccessResponse({ message: 'Permissions updated' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    if (message === 'Role not found') {
      return createErrorResponse(message, 404);
    }
    console.error('PATCH /api/roles/[id]/permissions error:', err);
    return createErrorResponse('Failed to update permissions', 500);
  }
}
