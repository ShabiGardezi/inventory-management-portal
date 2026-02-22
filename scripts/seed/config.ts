/**
 * Seed configuration from env: SEED_SCALE (small|medium|large), SEED_KEY (string for determinism).
 */

export type SeedScale = 'small' | 'medium' | 'large';

export interface SeedCounts {
  warehouses: number;
  products: number;
  purchases: number;
  sales: number;
  transfers: number;
  adjustments: number;
  daysBack: number;
  purchaseItemsMin: number;
  purchaseItemsMax: number;
  saleItemsMin: number;
  saleItemsMax: number;
}

const SCALE_COUNTS: Record<SeedScale, SeedCounts> = {
  small: {
    warehouses: 2,
    products: 40,
    purchases: 10,
    sales: 15,
    transfers: 5,
    adjustments: 4,
    daysBack: 90,
    purchaseItemsMin: 1,
    purchaseItemsMax: 5,
    saleItemsMin: 1,
    saleItemsMax: 4,
  },
  medium: {
    warehouses: 5,
    products: 200,
    purchases: 60,
    sales: 80,
    transfers: 25,
    adjustments: 20,
    daysBack: 90,
    purchaseItemsMin: 2,
    purchaseItemsMax: 8,
    saleItemsMin: 1,
    saleItemsMax: 6,
  },
  large: {
    warehouses: 10,
    products: 800,
    purchases: 250,
    sales: 300,
    transfers: 80,
    adjustments: 50,
    daysBack: 90,
    purchaseItemsMin: 2,
    purchaseItemsMax: 15,
    saleItemsMin: 1,
    saleItemsMax: 10,
  },
};

export function getSeedScale(): SeedScale {
  const v = process.env.SEED_SCALE?.toLowerCase();
  if (v === 'small' || v === 'medium' || v === 'large') return v;
  return 'small';
}

export function getSeedCounts(scale: SeedScale): SeedCounts {
  return { ...SCALE_COUNTS[scale] };
}

/** Deterministic numeric seed from SEED_KEY string (for initSeed). */
export function getSeedFromKey(): number {
  const key = process.env.SEED_KEY ?? 'default';
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(31, h) + key.charCodeAt(i);
    h = (h >>> 0) % 0xffffffff;
  }
  return h >>> 0 || 42;
}

export function getValuationMethod(): 'FIFO' | 'AVERAGE_COST' {
  const v = process.env.VALUATION_METHOD?.toUpperCase();
  if (v === 'FIFO' || v === 'AVERAGE_COST') return v;
  return 'AVERAGE_COST';
}

export function getEnableApprovals(): boolean {
  return process.env.ENABLE_APPROVALS === 'true';
}

export function getDisableLockdownAfterSeed(): boolean {
  return process.env.DISABLE_LOCKDOWN_AFTER_SEED === 'true';
}
