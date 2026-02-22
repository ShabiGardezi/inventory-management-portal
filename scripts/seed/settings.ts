/**
 * Phase 0: Settings (systemLockdown=true during seed, valuationMethod, allowNegativeStock=false).
 */

import type { PrismaClient } from '@prisma/client';
import type { ValuationMethod } from '@prisma/client';

const DEFAULT_STOCK_ADJUSTMENT_REASONS = [
  'damage',
  'recount',
  'correction',
  'opening_stock',
  'expiry',
  'found',
];

export async function createSettings(
  prisma: PrismaClient,
  options: {
    valuationMethod: ValuationMethod;
    systemLockdown: boolean;
    allowNegativeStock?: boolean;
    enableBarcode?: boolean;
  }
): Promise<void> {
  const existing = await prisma.settings.findFirst({
    where: { scope: 'GLOBAL', tenantId: null },
  });

  const data = {
    scope: 'GLOBAL' as const,
    tenantId: null as string | null,
    companyName: 'Demo Company',
    businessEmail: 'admin@local',
    phone: '+1 555-0100',
    address: '123 Demo Street',
    timezone: 'America/New_York',
    currency: 'USD',
    dateFormat: 'MM/dd/yyyy',
    invoicePrefix: 'INV-',
    invoiceNumberPattern: 'INV-{YYYY}-{NNNN}',
    defaultTaxRate: 10,
    allowNegativeStock: options.allowNegativeStock ?? false,
    enforceReorderLevelAlerts: true,
    stockAdjustmentReasons: DEFAULT_STOCK_ADJUSTMENT_REASONS,
    enableBarcode: options.enableBarcode ?? true,
    quantityPrecision: 'integer',
    lowStockThresholdBehavior: 'reorderLevel',
    valuationMethod: options.valuationMethod,
    showFinancials: true,
    systemLockdown: options.systemLockdown,
    allowProdWipe: false,
    lowStockNotificationsEnabled: true,
    dailySummaryEmailEnabled: false,
    weeklySummaryEmailEnabled: false,
    inAppNotificationsEnabled: true,
  };

  if (existing) {
    await prisma.settings.update({
      where: { id: existing.id },
      data: {
        ...data,
        valuationMethod: options.valuationMethod,
        systemLockdown: options.systemLockdown,
        allowNegativeStock: data.allowNegativeStock,
        enableBarcode: data.enableBarcode,
      },
    });
    return;
  }

  await prisma.settings.create({
    data: {
      ...data,
      scope: data.scope,
      tenantId: data.tenantId,
    },
  });
}

export async function updateSettingsLockdown(
  prisma: PrismaClient,
  systemLockdown: boolean
): Promise<void> {
  const existing = await prisma.settings.findFirst({
    where: { scope: 'GLOBAL', tenantId: null },
  });
  if (existing) {
    await prisma.settings.update({
      where: { id: existing.id },
      data: { systemLockdown },
    });
  }
}
