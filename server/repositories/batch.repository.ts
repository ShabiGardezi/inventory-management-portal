import type { PrismaClient } from '@prisma/client';

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface FindOrCreateBatchInput {
  productId: string;
  batchNumber: string;
  mfgDate?: Date | null;
  expiryDate?: Date | null;
  notes?: string | null;
}

/**
 * Find existing batch by (productId, batchNumber) or create one.
 * Used when product.trackBatches=true and batchNumber is provided on IN.
 */
export async function findOrCreateBatch(
  prisma: PrismaClient | PrismaTx,
  input: FindOrCreateBatchInput
): Promise<{ id: string; productId: string; batchNumber: string }> {
  const existing = await prisma.batch.findUnique({
    where: {
      productId_batchNumber: {
        productId: input.productId,
        batchNumber: input.batchNumber,
      },
    },
  });
  if (existing) return existing;

  const created = await prisma.batch.create({
    data: {
      productId: input.productId,
      batchNumber: input.batchNumber,
      mfgDate: input.mfgDate ?? undefined,
      expiryDate: input.expiryDate ?? undefined,
      notes: input.notes ?? undefined,
    },
  });
  return created;
}

export async function getBatchById(
  prisma: PrismaClient | PrismaTx,
  batchId: string
): Promise<{ id: string; productId: string; batchNumber: string } | null> {
  return prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, productId: true, batchNumber: true },
  });
}
