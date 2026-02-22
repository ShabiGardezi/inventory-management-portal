import { z } from 'zod';

/** Normalize string: trim and optional title-case for display fields */
export function normalizeStr(s: string): string {
  return s.trim();
}

/** Parse number from string; returns null if empty/invalid */
export function parseNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(typeof value === 'string' ? value.trim() : value);
  return Number.isFinite(n) ? n : null;
}

/** Parse boolean: TRUE/FALSE, true/false, 1/0 */
export function parseBool(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  const s = String(value).trim().toUpperCase();
  if (s === 'TRUE' || s === '1') return true;
  if (s === 'FALSE' || s === '0') return false;
  const n = Number(value);
  return Number.isFinite(n) ? n !== 0 : true;
}

/** Template column names (case-insensitive match) */
export const REQUIRED_COLUMNS = ['sku', 'name'] as const;
export const RECOMMENDED_COLUMNS = [
  'category',
  'unit',
  'costPrice',
  'sellPrice',
  'reorderLevel',
  'barcode',
  'isActive',
] as const;
export const OPTIONAL_COLUMNS = [
  'description',
  'openingStock',
  'warehouseCode',
] as const;

export const ALL_TEMPLATE_COLUMNS = [
  ...REQUIRED_COLUMNS,
  ...RECOMMENDED_COLUMNS,
  ...OPTIONAL_COLUMNS,
] as const;

/** Raw row from CSV/Excel (string keys, unknown values) */
export type RawImportRow = Record<string, unknown>;

/** Normalized column name (lowercase, trimmed) */
export function toColumnKey(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '');
}

/** Get cell value by possible column names (sku, SKU, Sku, etc.) */
export function getCell(row: RawImportRow, ...keys: readonly string[]): unknown {
  const normalized = keys.map((k) => toColumnKey(k));
  for (const [k, v] of Object.entries(row)) {
    if (normalized.includes(toColumnKey(k))) return v;
  }
  return undefined;
}

/** Zod schema for a single product row (after column mapping) */
export const productImportRowSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU must be 100 characters or less')
    .transform((s) => s.trim().toUpperCase())
    .refine((s) => /^[A-Z0-9\-_]+$/.test(s), 'SKU must contain only uppercase letters, numbers, hyphens, and underscores'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less')
    .transform((s) => s.trim()),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().nullable().transform((s) => (s ? normalizeStr(s) : null)),
  unit: z.string().max(50).default('pcs').transform((s) => (s ? normalizeStr(s) : 'pcs')),
  costPrice: z.number().min(0, 'Cost price must be >= 0').optional().nullable(),
  sellPrice: z.number().min(0, 'Sell price must be >= 0').optional().nullable(),
  reorderLevel: z.number().int().min(0, 'Reorder level must be >= 0').optional().nullable(),
  isActive: z.boolean().default(true),
  openingStock: z.number().min(0).optional().nullable(),
  warehouseCode: z.string().max(50).optional().nullable(),
});

export type ProductImportRow = z.infer<typeof productImportRowSchema>;

/** Map raw row to input for schema (with parsing); returns object suitable for safeParse */
export function rawRowToParseInput(row: RawImportRow): Record<string, unknown> {
  const get = (... keys: readonly string[]) => getCell(row, ...keys);
  const sku = get('sku');
  const name = get('name');
  const description = get('description');
  const category = get('category');
  const unit = get('unit');
  const costPrice = parseNum(get('costprice', 'costPrice'));
  const sellPrice = parseNum(get('sellprice', 'sellPrice', 'price'));
  const reorderLevelRaw = parseNum(get('reorderlevel', 'reorderLevel'));
  const reorderLevel = reorderLevelRaw !== null && Number.isInteger(reorderLevelRaw) ? reorderLevelRaw : null;
  const isActive = parseBool(get('isactive', 'isActive'));
  const openingStock = parseNum(get('openingstock', 'openingStock'));
  const warehouseCode = get('warehousecode', 'warehouseCode');
  return {
    sku: typeof sku === 'string' ? sku : String(sku ?? ''),
    name: typeof name === 'string' ? name : String(name ?? ''),
    description: description != null ? String(description) : undefined,
    category: category != null ? String(category) : undefined,
    unit: unit != null ? String(unit) : undefined,
    costPrice,
    sellPrice,
    reorderLevel,
    isActive,
    openingStock: openingStock ?? undefined,
    warehouseCode: warehouseCode != null ? String(warehouseCode).trim() : undefined,
  };
}

/** Validation result with row index and errors */
export interface RowValidationError {
  rowIndex: number;
  errors: string[];
}

export interface ValidRowWithIndex {
  row: ProductImportRow;
  rowIndex: number;
}

export function validateRows(rows: RawImportRow[]): {
  valid: ValidRowWithIndex[];
  errors: RowValidationError[];
} {
  const valid: ValidRowWithIndex[] = [];
  const errors: RowValidationError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const input = rawRowToParseInput(rows[i]);
    const result = productImportRowSchema.safeParse(input);
    if (result.success) {
      valid.push({ row: result.data, rowIndex: i + 1 });
    } else {
      const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      errors.push({ rowIndex: i + 1, errors: messages });
    }
  }
  return { valid, errors };
}
