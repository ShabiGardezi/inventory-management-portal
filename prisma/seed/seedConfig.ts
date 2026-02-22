/**
 * Seed configuration: all counts and options for deterministic bulk data generation.
 * Override via environment or pass programmatically.
 */
export interface SeedConfig {
  /** Seed for RNG (reproducible data when set) */
  seed: number;
  /** Number of users to create (excluding system accounts) */
  users: number;
  /** Warehouses count (Main + Branch 1..n) */
  warehouses: number;
  /** Products count */
  products: number;
  /** Suppliers count (used for purchase reference names only; no Supplier table) */
  suppliers: number;
  /** Customers count (used for sales reference names only; no Customer table) */
  customers: number;
  /** Purchase orders (IN movements grouped by referenceNumber) */
  purchases: number;
  /** Min/max line items per purchase */
  purchaseItemsMin: number;
  purchaseItemsMax: number;
  /** Sales orders (OUT movements grouped by referenceNumber) */
  sales: number;
  /** Min/max line items per sale */
  saleItemsMin: number;
  saleItemsMax: number;
  /** Transfers between warehouses */
  transfers: number;
  /** Stock adjustments */
  adjustments: number;
  /** Days in the past to spread movement dates */
  daysBack: number;
}

const defaultConfig: SeedConfig = {
  seed: typeof process.env.SEED !== 'undefined' ? parseInt(process.env.SEED, 10) || 42 : 42,
  users: 30,
  warehouses: 5,
  products: 1000,
  suppliers: 40,
  customers: 200,
  purchases: 250,
  purchaseItemsMin: 2,
  purchaseItemsMax: 15,
  sales: 600,
  saleItemsMin: 1,
  saleItemsMax: 10,
  transfers: 120,
  adjustments: 80,
  daysBack: 180,
};

export function getSeedConfig(overrides?: Partial<SeedConfig>): SeedConfig {
  return { ...defaultConfig, ...overrides };
}
