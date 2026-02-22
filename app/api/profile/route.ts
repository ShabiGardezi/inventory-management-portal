import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requireAuth,
  hasPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import * as settingsService from '@/server/services/settingsService';

const patchProfileSchema = z.object({
  name: z.string().min(1).max(255).nullable().optional(),
  email: z.string().email().max(255).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = patchProfileSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    const canUpdateEmail = hasPermission(user, 'users.update');
    if (parsed.data.email !== undefined && !canUpdateEmail) {
      return createErrorResponse('You do not have permission to change email', 403);
    }

    const result = await settingsService.updateProfile(
      user.id,
      { name: parsed.data.name, email: parsed.data.email },
      canUpdateEmail
    );
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Unauthorized: Authentication required') {
        return createErrorResponse(err.message, 401);
      }
      if (err.message === 'User not found') {
        return createErrorResponse(err.message, 404);
      }
    }
    console.error('PATCH /api/profile error:', err);
    return createErrorResponse('Failed to update profile', 500);
  }
}
