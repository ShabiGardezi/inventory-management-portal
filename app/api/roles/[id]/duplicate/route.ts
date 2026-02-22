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
  name: z.string().min(1, 'Role name is required').max(100),
});

export async function POST(
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
    const role = await service.duplicateRole(id, parsed.data.name, user.id);
    return createSuccessResponse(role, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    if (message === 'Source role not found') {
      return createErrorResponse('Role not found', 404);
    }
    if (message.includes('already exists')) {
      return createErrorResponse(message, 409);
    }
    console.error('POST /api/roles/[id]/duplicate error:', err);
    return createErrorResponse('Failed to duplicate role', 500);
  }
}
