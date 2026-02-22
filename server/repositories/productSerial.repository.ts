import type { PrismaClient } from '@prisma/client';

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type SerialStatus = 'IN_STOCK' | 'SOLD' | 'DAMAGED' | 'RETURNED';

/**
 * Create ProductSerial records for IN (e.g. receive, adjust increase).
 * All start as IN_STOCK; optional warehouseId and batchId.
 */
export async function createSerials(
  prisma: PrismaClient | PrismaTx,
  params: {
    productId: string;
    serialNumbers: string[];
    warehouseId: string | null;
    batchId: string | null;
    movementId: string | null;
  }
): Promise<{ id: string; serialNumber: string }[]> {
  if (params.serialNumbers.length === 0) return [];

  const created = await Promise.all(
    params.serialNumbers.map((serialNumber) =>
      prisma.productSerial.create({
        data: {
          productId: params.productId,
          serialNumber,
          status: 'IN_STOCK',
          warehouseId: params.warehouseId,
          batchId: params.batchId,
          movementId: params.movementId,
        },
        select: { id: true, serialNumber: true },
      })
    )
  );
  return created;
}

export interface SerialForOut {
  id: string;
  serialNumber: string;
  warehouseId: string | null;
  batchId: string | null;
}

/**
 * Find serials by productId and serial numbers; validate they are IN_STOCK and (if required) in the given warehouse and batch.
 * Returns serials in same order as requested; throws if any missing or not available.
 */
export async function findSerialsForOut(
  prisma: PrismaClient | PrismaTx,
  params: {
    productId: string;
    serialNumbers: string[];
    warehouseId: string;
    batchId?: string | null;
  }
): Promise<SerialForOut[]> {
  const serials = await prisma.productSerial.findMany({
    where: {
      productId: params.productId,
      serialNumber: { in: params.serialNumbers },
      status: 'IN_STOCK',
      warehouseId: params.warehouseId,
      ...(params.batchId != null ? { batchId: params.batchId } : {}),
    },
    select: { id: true, serialNumber: true, warehouseId: true, batchId: true },
  });

  const byNumber = new Map(serials.map((s) => [s.serialNumber, s]));
  const result: SerialForOut[] = [];
  for (const sn of params.serialNumbers) {
    const s = byNumber.get(sn);
    if (!s) {
      throw new Error(
        `Serial number "${sn}" not found or not IN_STOCK in warehouse ${params.warehouseId} for this product`
      );
    }
    result.push(s);
  }
  return result;
}

/**
 * Update serials to a new status and optionally set movementId and disposedAt.
 */
export async function updateSerialsStatus(
  prisma: PrismaClient | PrismaTx,
  params: {
    serialIds: string[];
    status: SerialStatus;
    movementId?: string | null;
    disposedAt?: Date | null;
  }
): Promise<void> {
  if (params.serialIds.length === 0) return;

  await prisma.productSerial.updateMany({
    where: { id: { in: params.serialIds } },
    data: {
      status: params.status,
      ...(params.movementId != null ? { movementId: params.movementId } : {}),
      ...(params.disposedAt != null ? { disposedAt: params.disposedAt } : {}),
    },
  });
}

/**
 * Update serials' warehouse (e.g. after transfer). Keeps status IN_STOCK.
 */
export async function updateSerialsWarehouse(
  prisma: PrismaClient | PrismaTx,
  params: {
    serialIds: string[];
    warehouseId: string;
    movementId?: string | null;
  }
): Promise<void> {
  if (params.serialIds.length === 0) return;

  await prisma.productSerial.updateMany({
    where: { id: { in: params.serialIds } },
    data: {
      warehouseId: params.warehouseId,
      ...(params.movementId != null ? { movementId: params.movementId } : {}),
    },
  });
}
