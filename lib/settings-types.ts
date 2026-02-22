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

export interface SettingsResponse {
  profile: UserProfileSettings;
  organization: OrganizationSettings | null;
  inventory: InventoryRules | null;
  notifications: NotificationPrefs | null;
  permissions: string[];
}
