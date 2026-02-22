import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RoleService } from '@/server/services/roleService';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

export async function GET(_request: NextRequest) {
  try {
    await requireAnyPermission(['roles.read', 'roles.manage']);
    const service = new RoleService(prisma);
    const grouped = await service.getPermissionsGrouped();
    return createSuccessResponse(grouped);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    console.error('GET /api/permissions error:', err);
    return createErrorResponse('Failed to fetch permissions', 500);
  }
}
