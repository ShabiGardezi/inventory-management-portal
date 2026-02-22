import type { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  validateRows,
  toColumnKey,
  ALL_TEMPLATE_COLUMNS,
  type ProductImportRow,
  type RowValidationError,
  type RawImportRow,
} from '@/server/validators/productImportSchemas';

export type { RawImportRow };

export interface ImportOptions {
  mode: 'create_only' | 'upsert';
  defaultWarehouseId?: string | null;
  allowPartial: boolean;
}

export interface ValidateResult {
  detectedColumns: { name: string; status: 'matched' | 'missing' }[];
  previewRows: RawImportRow[];
  totalRows: number;
  validationErrors: RowValidationError[];
  validCount: number;
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  failedRows: { rowIndex: number; sku: string; errors: string[] }[];
}

const PREVIEW_LIMIT = 20;

/** Parse CSV buffer (UTF-8) to array of row objects */
export function parseCSV(buffer: Buffer): RawImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const data = XLSX.utils.sheet_to_json<RawImportRow>(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  });
  return data.filter((row) => Object.keys(row).some((k) => row[k] !== undefined && String(row[k]).trim() !== ''));
}

/** Parse XLSX buffer to array of row objects */
export function parseXLSX(buffer: Buffer): RawImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const data = XLSX.utils.sheet_to_json<RawImportRow>(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  });
  return data.filter((row) => Object.keys(row).some((k) => row[k] !== undefined && String(row[k]).trim() !== ''));
}

/** Detect columns from first row keys */
function detectColumns(headers: string[]): { name: string; status: 'matched' | 'missing' }[] {
  const normalized = new Set(headers.map((h) => toColumnKey(h)));
  return ALL_TEMPLATE_COLUMNS.map((name) => ({
    name,
    status: (normalized.has(toColumnKey(name)) ? 'matched' : 'missing') as 'matched' | 'missing',
  }));
}

/** Validate file and return preview + errors (no DB write) */
export function validateImportFile(
  rows: RawImportRow[],
  previewLimit: number = PREVIEW_LIMIT
): ValidateResult {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const detectedColumns = detectColumns(headers);
  const { valid, errors } = validateRows(rows);
  return {
    detectedColumns,
    previewRows: rows.slice(0, previewLimit),
    totalRows: rows.length,
    validationErrors: errors,
    validCount: valid.length,
  };
}

/** Map validated row to Prisma create input (price = sellPrice, costPrice) */
function rowToProductData(row: ProductImportRow): {
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  price: number | null;
  costPrice: number | null;
  reorderLevel: number | null;
  isActive: boolean;
} {
  return {
    sku: row.sku,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    unit: row.unit,
    price: row.sellPrice ?? null,
    costPrice: row.costPrice ?? null,
    reorderLevel: row.reorderLevel ?? null,
    isActive: row.isActive,
  };
}

/** Create opening stock movement and balance for a product in a warehouse */
async function applyOpeningStock(
  prisma: PrismaClient,
  productId: string,
  warehouseId: string,
  quantity: number,
  userId: string | null
): Promise<void> {
  const ref = `IMPORT-${Date.now()}`;
  const now = new Date();
  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId,
        warehouseId,
        movementType: 'IN',
        quantity,
        referenceType: 'MANUAL',
        referenceId: ref,
        referenceNumber: ref,
        notes: 'Opening stock import',
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      },
    }),
    prisma.stockBalance.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      update: {
        quantity: { increment: quantity },
        available: { increment: quantity },
        lastUpdated: now,
        updatedAt: now,
      },
      create: {
        productId,
        warehouseId,
        quantity,
        reserved: 0,
        available: quantity,
        lastUpdated: now,
        updatedAt: now,
      },
    }),
  ]);
}

/** Run full import: validate, then create/upsert according to options */
export async function runImport(
  prisma: PrismaClient,
  rows: RawImportRow[],
  options: ImportOptions,
  userId: string | null
): Promise<ImportResult> {
  const { valid, errors: validationErrors } = validateRows(rows);
  const result: ImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    failed: 0,
    failedRows: [],
  };

  const errorRowIndices = new Set(validationErrors.map((e) => e.rowIndex));

  if (!options.allowPartial && validationErrors.length > 0) {
    result.failed = rows.length;
    result.failedRows = validationErrors.map((e) => ({
      rowIndex: e.rowIndex,
      sku: String(rows[e.rowIndex - 1]?.sku ?? rows[e.rowIndex - 1]?.SKU ?? ''),
      errors: e.errors,
    }));
    return result;
  }

  const skus = valid.map((r) => r.row.sku);
  const existing = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const existingBySku = new Map<string, { id: string }>();
  for (const p of existing) existingBySku.set(p.sku, { id: p.id });

  const runOne = async (
    row: ProductImportRow,
    rowIndex: number
  ): Promise<{ created?: number; updated?: number; failed?: { errors: string[] } }> => {
    const data = rowToProductData(row);
    if (options.mode === 'upsert' && existingBySku.has(row.sku)) {
      const existing = existingBySku.get(row.sku)!;
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          unit: data.unit,
          price: data.price,
          costPrice: data.costPrice,
          reorderLevel: data.reorderLevel,
          isActive: data.isActive,
        },
      });
      return { updated: 1 };
    }
    if (options.mode === 'create_only' && existingBySku.has(row.sku)) {
      return { failed: { errors: ['SKU already exists (create-only mode)'] } };
    }
    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        unit: data.unit,
        price: data.price,
        costPrice: data.costPrice,
        reorderLevel: data.reorderLevel,
        isActive: data.isActive,
      },
    });
    let openingQty = row.openingStock ?? 0;
    if (row.warehouseCode && row.openingStock != null && row.openingStock > 0) {
      const wh = await prisma.warehouse.findFirst({
        where: { code: { equals: row.warehouseCode, mode: 'insensitive' } },
      });
      if (wh) {
        await applyOpeningStock(prisma, product.id, wh.id, row.openingStock, userId);
        openingQty = 0;
      }
    }
    if (openingQty > 0 && options.defaultWarehouseId) {
      await applyOpeningStock(prisma, product.id, options.defaultWarehouseId, openingQty, userId);
    }
    return { created: 1 };
  };

  const allOrNothing = !options.allowPartial;
  if (allOrNothing && valid.length > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const { row, rowIndex } of valid) {
          if (errorRowIndices.has(rowIndex)) continue;
          const data = rowToProductData(row);
          if (options.mode === 'upsert' && existingBySku.has(row.sku)) {
            const existing = existingBySku.get(row.sku)!;
            await tx.product.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                description: data.description,
                category: data.category,
                unit: data.unit,
                price: data.price,
                costPrice: data.costPrice,
                reorderLevel: data.reorderLevel,
                isActive: data.isActive,
              },
            });
            result.updated++;
          } else if (options.mode === 'create_only' && existingBySku.has(row.sku)) {
            throw new Error(`SKU ${row.sku} already exists (create-only mode)`);
          } else {
            const product = await tx.product.create({
              data: {
                sku: data.sku,
                name: data.name,
                description: data.description,
                category: data.category,
                unit: data.unit,
                price: data.price,
                costPrice: data.costPrice,
                reorderLevel: data.reorderLevel,
                isActive: data.isActive,
              },
            });
            result.created++;
            if (row.openingStock != null && row.openingStock > 0 && options.defaultWarehouseId) {
              await tx.stockMovement.create({
                data: {
                  productId: product.id,
                  warehouseId: options.defaultWarehouseId,
                  movementType: 'IN',
                  quantity: row.openingStock,
                  referenceType: 'MANUAL',
                  referenceNumber: `IMPORT-${Date.now()}`,
                  notes: 'Opening stock import',
                  createdById: userId,
                },
              });
              await tx.stockBalance.upsert({
                where: {
                  productId_warehouseId: { productId: product.id, warehouseId: options.defaultWarehouseId },
                },
                update: {
                  quantity: { increment: row.openingStock },
                  available: { increment: row.openingStock },
                  lastUpdated: new Date(),
                  updatedAt: new Date(),
                },
                create: {
                  productId: product.id,
                  warehouseId: options.defaultWarehouseId,
                  quantity: row.openingStock,
                  reserved: 0,
                  available: row.openingStock,
                },
              });
            }
          }
        }
      });
    } catch (err) {
      result.failed = rows.length;
      result.failedRows = [
        {
          rowIndex: 1,
          sku: '',
          errors: [err instanceof Error ? err.message : 'Transaction failed'],
        },
      ];
      return result;
    }
  } else {
    for (const { row, rowIndex } of valid) {
      if (errorRowIndices.has(rowIndex)) continue;
      try {
        const out = await runOne(row, rowIndex);
        if (out.created) result.created++;
        else if (out.updated) result.updated++;
        else if (out.failed) {
          result.failed++;
          result.failedRows.push({ rowIndex, sku: row.sku, errors: out.failed.errors });
        }
      } catch (err) {
        result.failed++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.failedRows.push({ rowIndex, sku: row.sku, errors: [msg] });
      }
    }
  }

  for (const e of validationErrors) {
    result.failed++;
    result.failedRows.push({
      rowIndex: e.rowIndex,
      sku: String(rows[e.rowIndex - 1]?.sku ?? rows[e.rowIndex - 1]?.SKU ?? ''),
      errors: e.errors,
    });
  }

  return result;
}

/** Generate CSV template content */
export function generateCSVTemplate(): string {
  const headers = [
    'sku',
    'name',
    'category',
    'unit',
    'costPrice',
    'sellPrice',
    'reorderLevel',
    'barcode',
    'isActive',
    'description',
    'openingStock',
    'warehouseCode',
  ];
  const example = [
    'SKU-001',
    'Sample Product',
    'Electronics',
    'pcs',
    '10.00',
    '15.99',
    '10',
    '',
    'TRUE',
    'Optional description',
    '0',
    '',
  ];
  return [headers.join(','), example.join(',')].join('\n');
}

/** Generate XLSX template buffer */
export function generateXLSXTemplate(): Buffer {
  const headers = [
    'sku',
    'name',
    'category',
    'unit',
    'costPrice',
    'sellPrice',
    'reorderLevel',
    'barcode',
    'isActive',
    'description',
    'openingStock',
    'warehouseCode',
  ];
  const example = [
    'SKU-001',
    'Sample Product',
    'Electronics',
    'pcs',
    10,
    15.99,
    10,
    '',
    'TRUE',
    'Optional description',
    0,
    '',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** Build error report CSV content (failed rows + error column) */
export function buildErrorReportCSV(
  rows: RawImportRow[],
  failedRows: { rowIndex: number; sku: string; errors: string[] }[]
): string {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  if (headers.indexOf('error') === -1) headers.push('error');
  const lines: string[] = [headers.join(',')];
  for (const f of failedRows) {
    const row = rows[f.rowIndex - 1];
    const values = headers.map((h) => {
      if (h === 'error') return `"${f.errors.join('; ').replace(/"/g, '""')}"`;
      const v = row?.[h as keyof RawImportRow];
      const str = v === undefined || v === null ? '' : String(v);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}
