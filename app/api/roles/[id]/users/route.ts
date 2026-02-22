import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RoleService } from '@/server/services/roleService';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAnyPermission(['roles.read', 'roles.manage', 'users.read']);
    const { id } = await params;
    const service = new RoleService(prisma);
    const role = await service.getRoleById(id);
    if (!role) {
      return createErrorResponse('Role not found', 404);
    }
    const users = await service.getAssignedUsers(id);
    return createSuccessResponse(users);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    console.error('GET /api/roles/[id]/users error:', err);
    return createErrorResponse('Failed to fetch assigned users', 500);
  }
}
