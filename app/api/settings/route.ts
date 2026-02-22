import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getCurrentUser,
  requireAuth,
  requirePermission,
  hasPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import * as settingsService from '@/server/services/settingsService';

const patchSettingsSchema = z.object({
  organization: z
    .object({
      companyName: z.string().max(255).nullable().optional(),
      businessEmail: z.string().email().max(255).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      address: z.string().max(500).nullable().optional(),
      timezone: z.string().max(100).optional(),
      currency: z.string().length(3).optional(),
      dateFormat: z.string().max(50).optional(),
      invoicePrefix: z.string().max(20).nullable().optional(),
      invoiceNumberPattern: z.string().max(100).nullable().optional(),
      defaultTaxRate: z.number().min(0).max(100).nullable().optional(),
    })
    .strict()
    .optional(),
  inventory: z
    .object({
      allowNegativeStock: z.boolean().optional(),
      enforceReorderLevelAlerts: z.boolean().optional(),
      defaultWarehouseId: z.string().nullable().optional(),
      stockAdjustmentReasons: z.array(z.string()).optional(),
      enableBarcode: z.boolean().optional(),
      quantityPrecision: z.enum(['integer', 'decimal']).optional(),
      lowStockThresholdBehavior: z.enum(['reorderLevel', 'globalThreshold']).optional(),
    })
    .strict()
    .optional(),
  notifications: z
    .object({
      lowStockNotificationsEnabled: z.boolean().optional(),
      dailySummaryEmailEnabled: z.boolean().optional(),
      weeklySummaryEmailEnabled: z.boolean().optional(),
      notificationRecipientEmails: z.array(z.string().email()).optional(),
      inAppNotificationsEnabled: z.boolean().optional(),
    })
    .strict()
    .optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createErrorResponse('Unauthorized', 401);
    }

    const hasSettingsRead = hasPermission(user, 'settings.read');
    const [profile, settings] = await Promise.all([
      settingsService.getProfile(user.id),
      settingsService.getSettingsForUser(hasSettingsRead),
    ]);

    return createSuccessResponse({
      profile: profile ?? { id: user.id, name: user.name, email: user.email },
      organization: settings.organization,
      inventory: settings.inventory,
      notifications: settings.notifications,
      permissions: user.permissions,
    });
  } catch (err) {
    console.error('GET /api/settings error:', err);
    return createErrorResponse('Failed to load settings', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requirePermission('settings.update');
    const body = await request.json();
    const parsed = patchSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        `Validation error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    const payload: settingsService.SettingsPayload = {};
    if (parsed.data.organization) payload.organization = parsed.data.organization;
    if (parsed.data.inventory) payload.inventory = parsed.data.inventory;
    if (parsed.data.notifications) payload.notifications = parsed.data.notifications;

    const result = await settingsService.updateSettings(user.id, payload);
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Unauthorized: Authentication required') {
        return createErrorResponse(err.message, 401);
      }
      if (err.message.startsWith('Forbidden:')) {
        return createErrorResponse(err.message, 403);
      }
    }
    console.error('PATCH /api/settings error:', err);
    return createErrorResponse('Failed to update settings', 500);
  }
}
