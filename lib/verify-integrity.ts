/**
 * Integrity verification for stock ledger and balances.
 * Used by scripts/verify-integrity.ts and integration tests.
 *
 * Grouping: (productId, warehouseId, batchId). Each balance row is keyed by
 * (productId, warehouseId, batchId); movements with matching batchId contribute
 * to that key's ledger sum. If the database does not yet have batchId columns
 * (migrations not applied), falls back to (productId, warehouseId) grouping.
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

const DECIMAL_TOLERANCE = 0.001;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function balanceKey(productId: string, warehouseId: string, batchId: string | null): string {
  return `${productId}:${warehouseId}:${batchId ?? 'null'}`;
}

function signedQuantity(movementType: string, quantity: number): number {
  if (movementType === 'IN') return quantity;
  if (movementType === 'OUT') return -quantity;
  return 0;
}

interface BalanceRow {
  productId: string;
  warehouseId: string;
  batchId: string | null;
  quantity: number;
}

interface MovementRow {
  productId: string;
  warehouseId: string;
  batchId: string | null;
  movementType: string;
  quantity: number;
}

async function fetchBalancesAndMovements(
  prisma: PrismaClient
): Promise<{ balances: BalanceRow[]; movements: MovementRow[] }> {
  try {
    const [balances, movements] = await Promise.all([
      prisma.stockBalance.findMany({
        select: { productId: true, warehouseId: true, batchId: true, quantity: true },
      }),
      prisma.stockMovement.findMany({
        select: { productId: true, warehouseId: true, batchId: true, movementType: true, quantity: true },
      }),
    ]);
    return {
      balances: balances.map((b) => ({
        productId: b.productId,
        warehouseId: b.warehouseId,
        batchId: b.batchId,
        quantity: Number(b.quantity),
      })),
      movements: movements.map((m) => ({
        productId: m.productId,
        warehouseId: m.warehouseId,
        batchId: m.batchId,
        movementType: m.movementType,
        quantity: Number(m.quantity),
      })),
    };
  } catch (err) {
    const isBatchIdMissing =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2022' &&
      String((err.meta as { column?: string } | null)?.column ?? '').includes('batchId');
    if (!isBatchIdMissing) throw err;

    const [balancesRaw, movementsRaw] = await Promise.all([
      prisma.$queryRaw<Array<{ productId: string; warehouseId: string; quantity: unknown }>>(
        Prisma.sql`SELECT "productId", "warehouseId", quantity FROM stock_balances`
      ),
      prisma.$queryRaw<Array<{ productId: string; warehouseId: string; movementType: string; quantity: unknown }>>(
        Prisma.sql`SELECT "productId", "warehouseId", "movementType", quantity FROM stock_movements`
      ),
    ]);
    return {
      balances: balancesRaw.map((b) => ({
        productId: b.productId,
        warehouseId: b.warehouseId,
        batchId: null as string | null,
        quantity: Number(b.quantity),
      })),
      movements: movementsRaw.map((m) => ({
        productId: m.productId,
        warehouseId: m.warehouseId,
        batchId: null as string | null,
        movementType: m.movementType,
        quantity: Number(m.quantity),
      })),
    };
  }
}

export interface IntegrityResult {
  ok: boolean;
  errors: string[];
}

export async function runIntegrityChecks(prisma: PrismaClient): Promise<IntegrityResult> {
  const errors: string[] = [];

  const { balances, movements } = await fetchBalancesAndMovements(prisma);

  const ledgerByKey = new Map<string, number>();
  for (const m of movements) {
    const key = balanceKey(m.productId, m.warehouseId, m.batchId);
    const signed = signedQuantity(m.movementType, m.quantity);
    ledgerByKey.set(key, (ledgerByKey.get(key) ?? 0) + signed);
  }

  for (const b of balances) {
    const key = balanceKey(b.productId, b.warehouseId, b.batchId);
    const actual = b.quantity;
    const expected = round2(ledgerByKey.get(key) ?? 0);
    const actualRounded = round2(actual);
    if (Math.abs(actualRounded - expected) > DECIMAL_TOLERANCE) {
      errors.push(
        `Balance mismatch (productId=${b.productId}, warehouseId=${b.warehouseId}, batchId=${b.batchId ?? 'null'}): ` +
          `expected=${expected} (SUM movements), actual=${actual} (stock_balances.quantity)`
      );
    }
  }

  const transferMovements = await prisma.stockMovement.findMany({
    where: { referenceType: 'TRANSFER' },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      movementType: true,
      quantity: true,
      referenceId: true,
    },
  });

  const byRefId = new Map<string, typeof transferMovements>();
  for (const m of transferMovements) {
    const refId = m.referenceId ?? 'null';
    if (!byRefId.has(refId)) byRefId.set(refId, []);
    byRefId.get(refId)!.push(m);
  }

  for (const [refId, list] of byRefId) {
    if (list.length !== 2) {
      errors.push(
        `Transfer referenceId=${refId}: expected exactly 2 movement rows (+qty and -qty), got ${list.length}`
      );
      continue;
    }
    const [a, b] = list;
    const qA = Number(a.quantity);
    const qB = Number(b.quantity);
    const oneIn = a.movementType === 'IN' && b.movementType === 'OUT';
    const oneOut = a.movementType === 'OUT' && b.movementType === 'IN';
    if (!(oneIn || oneOut)) {
      errors.push(
        `Transfer referenceId=${refId}: expected one IN (+qty) and one OUT (-qty), got ${a.movementType} and ${b.movementType}`
      );
    }
    if (Math.abs(qA - qB) > DECIMAL_TOLERANCE) {
      errors.push(`Transfer referenceId=${refId}: quantities must match, got ${qA} and ${qB}`);
    }
    if (a.productId !== b.productId) {
      errors.push(
        `Transfer referenceId=${refId}: productId must match, got ${a.productId} and ${b.productId}`
      );
    }
  }

  const settings = await prisma.settings.findFirst({
    where: { scope: 'GLOBAL', tenantId: null },
    select: { allowNegativeStock: true },
  });
  const allowNegative = settings?.allowNegativeStock ?? false;
  if (!allowNegative) {
    for (const b of balances) {
      const q = Number(b.quantity);
      if (q < -DECIMAL_TOLERANCE) {
        errors.push(
          `Negative balance (productId=${b.productId}, warehouseId=${b.warehouseId}, batchId=${b.batchId ?? 'null'}): quantity=${q} but allowNegativeStock=false`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
