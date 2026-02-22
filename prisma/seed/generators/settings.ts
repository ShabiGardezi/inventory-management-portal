import type { PrismaClient } from '@prisma/client';

const DEFAULT_STOCK_ADJUSTMENT_REASONS = ['damage', 'recount', 'correction', 'opening_stock', 'expiry', 'found'];

export async function seedSettings(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.settings.findFirst({
    where: { scope: 'GLOBAL', tenantId: null },
  });
  const data = {
    scope: 'GLOBAL' as const,
    tenantId: null as string | null,
    companyName: 'Demo Company',
    businessEmail: 'admin@demo.example.com',
    phone: '+1 555-0100',
    address: '123 Demo Street',
    timezone: 'America/New_York',
    currency: 'USD',
    dateFormat: 'MM/dd/yyyy',
    invoicePrefix: 'INV-',
    invoiceNumberPattern: 'INV-{YYYY}-{NNNN}',
    defaultTaxRate: 10,
    allowNegativeStock: false,
    enforceReorderLevelAlerts: true,
    stockAdjustmentReasons: DEFAULT_STOCK_ADJUSTMENT_REASONS,
    enableBarcode: false,
    quantityPrecision: 'integer',
    lowStockThresholdBehavior: 'reorderLevel',
    lowStockNotificationsEnabled: true,
    dailySummaryEmailEnabled: false,
    weeklySummaryEmailEnabled: false,
    inAppNotificationsEnabled: true,
  };
  if (existing) {
    await prisma.settings.update({
      where: { id: existing.id },
      data: {
        companyName: data.companyName,
        businessEmail: data.businessEmail,
        phone: data.phone,
        address: data.address,
        timezone: data.timezone,
        currency: data.currency,
        dateFormat: data.dateFormat,
        invoicePrefix: data.invoicePrefix,
        invoiceNumberPattern: data.invoiceNumberPattern,
        defaultTaxRate: data.defaultTaxRate,
        allowNegativeStock: data.allowNegativeStock,
        enforceReorderLevelAlerts: data.enforceReorderLevelAlerts,
        stockAdjustmentReasons: data.stockAdjustmentReasons,
        enableBarcode: data.enableBarcode,
        quantityPrecision: data.quantityPrecision,
        lowStockThresholdBehavior: data.lowStockThresholdBehavior,
        lowStockNotificationsEnabled: data.lowStockNotificationsEnabled,
        dailySummaryEmailEnabled: data.dailySummaryEmailEnabled,
        weeklySummaryEmailEnabled: data.weeklySummaryEmailEnabled,
        inAppNotificationsEnabled: data.inAppNotificationsEnabled,
      },
    });
    return;
  }
  await prisma.settings.create({
    data: {
      scope: data.scope,
      tenantId: data.tenantId,
      companyName: data.companyName,
      businessEmail: data.businessEmail,
      phone: data.phone,
      address: data.address,
      timezone: data.timezone,
      currency: data.currency,
      dateFormat: data.dateFormat,
      invoicePrefix: data.invoicePrefix,
      invoiceNumberPattern: data.invoiceNumberPattern,
      defaultTaxRate: data.defaultTaxRate,
      allowNegativeStock: data.allowNegativeStock,
      enforceReorderLevelAlerts: data.enforceReorderLevelAlerts,
      stockAdjustmentReasons: data.stockAdjustmentReasons,
      enableBarcode: data.enableBarcode,
      quantityPrecision: data.quantityPrecision,
      lowStockThresholdBehavior: data.lowStockThresholdBehavior,
      lowStockNotificationsEnabled: data.lowStockNotificationsEnabled,
      dailySummaryEmailEnabled: data.dailySummaryEmailEnabled,
      weeklySummaryEmailEnabled: data.weeklySummaryEmailEnabled,
      inAppNotificationsEnabled: data.inAppNotificationsEnabled,
    },
  });
}
