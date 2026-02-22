import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requireAuth,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import * as settingsService from '@/server/services/settingsService';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  });

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    await settingsService.changePassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    return createSuccessResponse({ message: 'Password updated successfully' });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Unauthorized: Authentication required') {
        return createErrorResponse(err.message, 401);
      }
      if (err.message === 'Current password is incorrect') {
        return createErrorResponse(err.message, 400);
      }
      if (err.message === 'User not found') {
        return createErrorResponse(err.message, 404);
      }
    }
    console.error('PATCH /api/profile/password error:', err);
    return createErrorResponse('Failed to change password', 500);
  }
}
