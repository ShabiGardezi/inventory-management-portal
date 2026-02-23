export const MARKETING_ROUTES = {
  home: '/',
  pricing: '/pricing',
  demo: '/demo',
  blog: '/blog',
} as const;

export const FEATURE_SLUGS = [
  'inventory-management-software',
  'warehouse-management-system',
  'batch-serial-tracking-software',
  'fifo-inventory-software',
  'inventory-valuation-software',
  'inventory-approval-workflow',
  'barcode-inventory-system',
  'reorder-forecasting-software',
] as const;

export type FeatureSlug = (typeof FEATURE_SLUGS)[number];

export function isFeatureSlug(value: string): value is FeatureSlug {
  return (FEATURE_SLUGS as readonly string[]).includes(value);
}

