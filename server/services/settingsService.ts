import { prisma } from '@/lib/prisma';
import * as settingsRepo from '@/server/repositories/settingsRepo';
import * as auditService from '@/server/services/auditService';

export interface UserProfileSettings {
  id: string;
  name: string | null;
  email: string;
}

export interface OrganizationSettings {
  companyName: string | null;
  businessEmail: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  dateFormat: string;
  invoicePrefix: string | null;
  invoiceNumberPattern: string | null;
  defaultTaxRate: number | null;
}

export interface InventoryRules {
  allowNegativeStock: boolean;
  enforceReorderLevelAlerts: boolean;
  defaultWarehouseId: string | null;
  stockAdjustmentReasons: string[];
  enableBarcode: boolean;
  quantityPrecision: string;
  lowStockThresholdBehavior: string;
}

export interface NotificationPrefs {
  lowStockNotificationsEnabled: boolean;
  dailySummaryEmailEnabled: boolean;
  weeklySummaryEmailEnabled: boolean;
  notificationRecipientEmails: string[];
  inAppNotificationsEnabled: boolean;
}

export interface SettingsPayload {
  organization?: Partial<OrganizationSettings>;
  inventory?: Partial<InventoryRules>;
  notifications?: Partial<NotificationPrefs>;
}

function rowToOrganization(row: settingsRepo.SettingsRow): OrganizationSettings {
  return {
    companyName: row.companyName,
    businessEmail: row.businessEmail,
    phone: row.phone,
    address: row.address,
    timezone: row.timezone,
    currency: row.currency,
    dateFormat: row.dateFormat,
    invoicePrefix: row.invoicePrefix,
    invoiceNumberPattern: row.invoiceNumberPattern,
    defaultTaxRate: row.defaultTaxRate != null ? Number(row.defaultTaxRate) : null,
  };
}

function rowToInventory(row: settingsRepo.SettingsRow): InventoryRules {
  return {
    allowNegativeStock: row.allowNegativeStock,
    enforceReorderLevelAlerts: row.enforceReorderLevelAlerts,
    defaultWarehouseId: row.defaultWarehouseId,
    stockAdjustmentReasons: row.stockAdjustmentReasons,
    enableBarcode: row.enableBarcode,
    quantityPrecision: row.quantityPrecision,
    lowStockThresholdBehavior: row.lowStockThresholdBehavior,
  };
}

function rowToNotifications(row: settingsRepo.SettingsRow): NotificationPrefs {
  return {
    lowStockNotificationsEnabled: row.lowStockNotificationsEnabled,
    dailySummaryEmailEnabled: row.dailySummaryEmailEnabled,
    weeklySummaryEmailEnabled: row.weeklySummaryEmailEnabled,
    notificationRecipientEmails: row.notificationRecipientEmails,
    inAppNotificationsEnabled: row.inAppNotificationsEnabled,
  };
}

export async function getProfile(userId: string): Promise<UserProfileSettings | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  return user;
}

/** Used by stock APIs to respect inventory rules (e.g. allowNegativeStock). */
export async function getInventoryRules(): Promise<{
  allowNegativeStock: boolean;
  defaultWarehouseId: string | null;
} | null> {
  const row = await settingsRepo.getGlobalSettings();
  if (!row)
    return { allowNegativeStock: false, defaultWarehouseId: null };
  return {
    allowNegativeStock: row.allowNegativeStock,
    defaultWarehouseId: row.defaultWarehouseId,
  };
}

/** Used by dashboard/formatting to get locale (currency, timezone). */
export async function getFormatSettings(): Promise<{ currency: string; timezone: string; dateFormat: string }> {
  const row = await settingsRepo.getGlobalSettings();
  if (!row)
    return { currency: 'USD', timezone: 'UTC', dateFormat: 'MM/dd/yyyy' };
  return {
    currency: row.currency,
    timezone: row.timezone,
    dateFormat: row.dateFormat,
  };
}

export async function getSettingsForUser(hasSettingsRead: boolean): Promise<{
  organization: OrganizationSettings | null;
  inventory: InventoryRules | null;
  notifications: NotificationPrefs | null;
}> {
  const row = await settingsRepo.getGlobalSettings();
  if (!row) {
    const defaults: OrganizationSettings = {
      companyName: null,
      businessEmail: null,
      phone: null,
      address: null,
      timezone: 'UTC',
      currency: 'USD',
      dateFormat: 'MM/dd/yyyy',
      invoicePrefix: null,
      invoiceNumberPattern: null,
      defaultTaxRate: null,
    };
    const invDefaults: InventoryRules = {
      allowNegativeStock: false,
      enforceReorderLevelAlerts: true,
      defaultWarehouseId: null,
      stockAdjustmentReasons: [],
      enableBarcode: false,
      quantityPrecision: 'integer',
      lowStockThresholdBehavior: 'reorderLevel',
    };
    const notifDefaults: NotificationPrefs = {
      lowStockNotificationsEnabled: true,
      dailySummaryEmailEnabled: false,
      weeklySummaryEmailEnabled: false,
      notificationRecipientEmails: [],
      inAppNotificationsEnabled: true,
    };
    return {
      organization: hasSettingsRead ? defaults : null,
      inventory: hasSettingsRead ? invDefaults : null,
      notifications: hasSettingsRead ? notifDefaults : null,
    };
  }
  return {
    organization: hasSettingsRead ? rowToOrganization(row) : null,
    inventory: hasSettingsRead ? rowToInventory(row) : null,
    notifications: hasSettingsRead ? rowToNotifications(row) : null,
  };
}

export async function updateSettings(
  userId: string,
  payload: SettingsPayload
): Promise<{ organization: OrganizationSettings; inventory: InventoryRules; notifications: NotificationPrefs }> {
  const existing = await settingsRepo.getGlobalSettings();
  const before = existing
    ? {
        organization: rowToOrganization(existing),
        inventory: rowToInventory(existing),
        notifications: rowToNotifications(existing),
      }
    : null;

  const update: settingsRepo.SettingsUpdateInput = {};
  if (payload.organization) {
    if (payload.organization.companyName !== undefined) update.companyName = payload.organization.companyName;
    if (payload.organization.businessEmail !== undefined) update.businessEmail = payload.organization.businessEmail;
    if (payload.organization.phone !== undefined) update.phone = payload.organization.phone;
    if (payload.organization.address !== undefined) update.address = payload.organization.address;
    if (payload.organization.timezone !== undefined) update.timezone = payload.organization.timezone;
    if (payload.organization.currency !== undefined) update.currency = payload.organization.currency;
    if (payload.organization.dateFormat !== undefined) update.dateFormat = payload.organization.dateFormat;
    if (payload.organization.invoicePrefix !== undefined) update.invoicePrefix = payload.organization.invoicePrefix;
    if (payload.organization.invoiceNumberPattern !== undefined)
      update.invoiceNumberPattern = payload.organization.invoiceNumberPattern;
    if (payload.organization.defaultTaxRate !== undefined)
      update.defaultTaxRate = payload.organization.defaultTaxRate;
  }
  if (payload.inventory) {
    if (payload.inventory.allowNegativeStock !== undefined)
      update.allowNegativeStock = payload.inventory.allowNegativeStock;
    if (payload.inventory.enforceReorderLevelAlerts !== undefined)
      update.enforceReorderLevelAlerts = payload.inventory.enforceReorderLevelAlerts;
    if (payload.inventory.defaultWarehouseId !== undefined)
      update.defaultWarehouseId = payload.inventory.defaultWarehouseId;
    if (payload.inventory.stockAdjustmentReasons !== undefined)
      update.stockAdjustmentReasons = payload.inventory.stockAdjustmentReasons;
    if (payload.inventory.enableBarcode !== undefined) update.enableBarcode = payload.inventory.enableBarcode;
    if (payload.inventory.quantityPrecision !== undefined)
      update.quantityPrecision = payload.inventory.quantityPrecision;
    if (payload.inventory.lowStockThresholdBehavior !== undefined)
      update.lowStockThresholdBehavior = payload.inventory.lowStockThresholdBehavior;
  }
  if (payload.notifications) {
    if (payload.notifications.lowStockNotificationsEnabled !== undefined)
      update.lowStockNotificationsEnabled = payload.notifications.lowStockNotificationsEnabled;
    if (payload.notifications.dailySummaryEmailEnabled !== undefined)
      update.dailySummaryEmailEnabled = payload.notifications.dailySummaryEmailEnabled;
    if (payload.notifications.weeklySummaryEmailEnabled !== undefined)
      update.weeklySummaryEmailEnabled = payload.notifications.weeklySummaryEmailEnabled;
    if (payload.notifications.notificationRecipientEmails !== undefined)
      update.notificationRecipientEmails = payload.notifications.notificationRecipientEmails;
    if (payload.notifications.inAppNotificationsEnabled !== undefined)
      update.inAppNotificationsEnabled = payload.notifications.inAppNotificationsEnabled;
  }

  const updated = await settingsRepo.upsertGlobalSettings(update);
  const after = {
    organization: rowToOrganization(updated),
    inventory: rowToInventory(updated),
    notifications: rowToNotifications(updated),
  };

  await auditService.logSettingsChange(
    userId,
    'settings',
    updated.id,
    'Updated system settings',
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>
  );

  return after;
}

export interface UpdateProfileInput {
  name?: string | null;
  email?: string;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
  canUpdateEmail: boolean
): Promise<UserProfileSettings> {
  const before = await getProfile(userId);
  if (!before) throw new Error('User not found');

  const data: { name?: string | null; email?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined && canUpdateEmail) data.email = input.email;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true },
  });

  await auditService.logProfileChange(
    userId,
    'Updated profile',
    { name: before.name, email: before.email },
    { name: updated.name, email: updated.email }
  );

  return updated;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { hashPassword } = await import('@/lib/utils/password');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new Error('User not found');

  const { verifyPassword } = await import('@/lib/utils/password');
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new Error('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await auditService.createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'user_profile',
    resourceId: userId,
    description: 'Password changed',
    metadata: {},
  });
}
