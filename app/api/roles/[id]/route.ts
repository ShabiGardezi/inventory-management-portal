import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { RoleService } from '@/server/services/roleService';
import {
  requireAnyPermission,
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const updateBodySchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAnyPermission(['roles.read', 'roles.manage']);
    const { id } = await params;
    const service = new RoleService(prisma);
    const role = await service.getRoleById(id);
    if (!role) {
      return createErrorResponse('Role not found', 404);
    }
    return createSuccessResponse(role);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    console.error('GET /api/roles/[id] error:', err);
    return createErrorResponse('Failed to fetch role', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('roles.manage');
    const { id } = await params;
    const body = await request.json();
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        400
      );
    }
    const service = new RoleService(prisma);
    const role = await service.updateRole(id, parsed.data, user.id);
    return createSuccessResponse(role);
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
    if (message.includes('already exists')) {
      return createErrorResponse(message, 409);
    }
    console.error('PATCH /api/roles/[id] error:', err);
    return createErrorResponse('Failed to update role', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('roles.manage');
    const { id } = await params;
    const service = new RoleService(prisma);
    await service.deleteRole(id, user.id);
    return createSuccessResponse({ message: 'Role deleted' });
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
    if (message.includes('System roles') || message.includes('assigned users')) {
      return createErrorResponse(message, 400);
    }
    console.error('DELETE /api/roles/[id] error:', err);
    return createErrorResponse('Failed to delete role', 500);
  }
}
