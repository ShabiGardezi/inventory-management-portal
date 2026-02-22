import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

const GLOBAL_SCOPE = 'GLOBAL';

export type SettingsCreateInput = Prisma.SettingsCreateInput;
export type SettingsUpdateInput = Prisma.SettingsUpdateInput;

export interface SettingsRow {
  id: string;
  scope: string;
  tenantId: string | null;
  companyName: string | null;
  businessEmail: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  dateFormat: string;
  invoicePrefix: string | null;
  invoiceNumberPattern: string | null;
  defaultTaxRate: Prisma.Decimal | null;
  allowNegativeStock: boolean;
  enforceReorderLevelAlerts: boolean;
  defaultWarehouseId: string | null;
  stockAdjustmentReasons: string[];
  enableBarcode: boolean;
  quantityPrecision: string;
  lowStockThresholdBehavior: string;
  lowStockNotificationsEnabled: boolean;
  dailySummaryEmailEnabled: boolean;
  weeklySummaryEmailEnabled: boolean;
  notificationRecipientEmails: string[];
  inAppNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getGlobalSettings(): Promise<SettingsRow | null> {
  return prisma.settings.findFirst({
    where: { scope: GLOBAL_SCOPE, tenantId: null } as { scope: string; tenantId: string | null },
  });
}

export async function getSettingsByTenant(tenantId: string): Promise<SettingsRow | null> {
  return prisma.settings.findUnique({
    where: {
      scope_tenantId: { scope: 'TENANT', tenantId },
    },
  });
}

export async function upsertGlobalSettings(
  data: SettingsUpdateInput
): Promise<SettingsRow> {
  const existing = await prisma.settings.findFirst({
    where: { scope: GLOBAL_SCOPE, tenantId: null },
  });
  if (existing) {
    return prisma.settings.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.settings.create({
    data: {
      scope: GLOBAL_SCOPE,
      tenantId: null,
      ...data,
    } as SettingsCreateInput,
  });
}

export async function getUserSettings(userId: string): Promise<{
  id: string;
  userId: string;
  theme: string | null;
  tablePageSize: number | null;
  preferences: unknown;
} | null> {
  return prisma.userSettings.findUnique({
    where: { userId },
  });
}

export async function upsertUserSettings(
  userId: string,
  data: Prisma.UserSettingsUpdateInput
): Promise<{ id: string; userId: string; theme: string | null; tablePageSize: number | null; preferences: unknown }> {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...data } as Prisma.UserSettingsCreateInput,
    update: data,
  });
}
