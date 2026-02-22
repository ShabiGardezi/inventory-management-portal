import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

/** Minimal product + stock snapshot for scan lookup. */
export interface ScanLookupProduct {
  match: 'product';
  product: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    trackBatches: boolean;
    trackSerials: boolean;
  };
  stock: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    batchId: string | null;
    batchNumber: string | null;
  }>;
}

/** Minimal batch + product + stock snapshot. */
export interface ScanLookupBatch {
  match: 'batch';
  product: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    trackBatches: boolean;
    trackSerials: boolean;
  };
  batch: {
    id: string;
    batchNumber: string;
    barcode: string | null;
    expiryDate: string | null;
  };
  stock: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
  }>;
}

/** Minimal serial + product + location. */
export interface ScanLookupSerial {
  match: 'serial';
  product: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    trackSerials: boolean;
  };
  serial: {
    id: string;
    serialNumber: string;
    status: string;
    warehouseId: string | null;
    warehouseName: string | null;
  };
}

export type ScanLookupResult = ScanLookupProduct | ScanLookupBatch | ScanLookupSerial;

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(['inventory.read', 'inventory:read']);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim();
    if (!code) {
      return createErrorResponse('Missing or empty code', 400);
    }

    // 1) Product by barcode OR sku (indexed: sku unique, barcode index)
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ sku: code }, { barcode: code }],
      },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        unit: true,
        trackBatches: true,
        trackSerials: true,
      },
    });
    if (product) {
      const balances = await prisma.stockBalance.findMany({
        where: { productId: product.id },
        select: {
          warehouseId: true,
          quantity: true,
          batchId: true,
          warehouse: { select: { name: true } },
          batch: { select: { batchNumber: true } },
        },
      });
      const stock = balances.map((b) => ({
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        quantity: Number(b.quantity),
        batchId: b.batchId,
        batchNumber: b.batch?.batchNumber ?? null,
      }));
      return createSuccessResponse({
        match: 'product',
        product: {
          ...product,
          barcode: product.barcode ?? null,
        },
        stock,
      } satisfies ScanLookupProduct);
    }

    // 2) Batch by barcode OR batchNumber (indexed: barcode index; batchNumber via unique)
    const batch = await prisma.batch.findFirst({
      where: {
        OR: [{ batchNumber: code }, { barcode: code }],
      },
      select: {
        id: true,
        batchNumber: true,
        barcode: true,
        expiryDate: true,
        productId: true,
        product: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            name: true,
            unit: true,
            trackBatches: true,
            trackSerials: true,
          },
        },
      },
    });
    if (batch) {
      const balances = await prisma.stockBalance.findMany({
        where: { batchId: batch.id },
        select: {
          warehouseId: true,
          quantity: true,
          warehouse: { select: { name: true } },
        },
      });
      const stock = balances.map((b) => ({
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        quantity: Number(b.quantity),
      }));
      return createSuccessResponse({
        match: 'batch',
        product: {
          ...batch.product,
          barcode: batch.product.barcode ?? null,
        },
        batch: {
          id: batch.id,
          batchNumber: batch.batchNumber,
          barcode: batch.barcode ?? null,
          expiryDate: batch.expiryDate?.toISOString() ?? null,
        },
        stock,
      } satisfies ScanLookupBatch);
    }

    // 3) ProductSerial by serialNumber (indexed)
    const serial = await prisma.productSerial.findFirst({
      where: { serialNumber: code },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        warehouseId: true,
        productId: true,
        product: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            name: true,
            unit: true,
            trackSerials: true,
          },
        },
        warehouse: { select: { name: true } },
      },
    });
    if (serial) {
      return createSuccessResponse({
        match: 'serial',
        product: {
          ...serial.product,
          barcode: serial.product.barcode ?? null,
        },
        serial: {
          id: serial.id,
          serialNumber: serial.serialNumber,
          status: serial.status,
          warehouseId: serial.warehouseId,
          warehouseName: serial.warehouse?.name ?? null,
        },
      } satisfies ScanLookupSerial);
    }

    return createSuccessResponse({ match: null, message: 'No match found' }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup failed';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error('GET /api/scan/lookup error:', err);
    return createErrorResponse('Lookup failed', 500);
  }
}
