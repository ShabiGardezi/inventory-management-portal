/**
 * Integrity verification for stock ledger and balances.
 * Used by scripts/verify-integrity.ts and integration tests.
 */

import type { PrismaClient } from '@prisma/client';

const DECIMAL_TOLERANCE = 0.001;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function signedQuantity(movementType: string, quantity: number): number {
  if (movementType === 'IN') return quantity;
  if (movementType === 'OUT') return -quantity;
  return 0;
}

export interface IntegrityResult {
  ok: boolean;
  errors: string[];
}

export async function runIntegrityChecks(prisma: PrismaClient): Promise<IntegrityResult> {
  const errors: string[] = [];

  const balances = await prisma.stockBalance.findMany({
    select: { productId: true, warehouseId: true, quantity: true },
  });
  const movements = await prisma.stockMovement.findMany({
    select: { productId: true, warehouseId: true, movementType: true, quantity: true },
  });

  const ledgerByKey = new Map<string, number>();
  for (const m of movements) {
    const key = `${m.productId}:${m.warehouseId}`;
    const q = Number(m.quantity);
    const signed = signedQuantity(m.movementType, q);
    ledgerByKey.set(key, (ledgerByKey.get(key) ?? 0) + signed);
  }

  for (const b of balances) {
    const key = `${b.productId}:${b.warehouseId}`;
    const balanceQty = Number(b.quantity);
    const ledgerSum = round2(ledgerByKey.get(key) ?? 0);
    const balanceRounded = round2(balanceQty);
    if (Math.abs(balanceRounded - ledgerSum) > DECIMAL_TOLERANCE) {
      errors.push(
        `Balance mismatch (productId=${b.productId}, warehouseId=${b.warehouseId}): ` +
          `stock_balance.quantity=${balanceQty} != SUM(movements)=${ledgerSum}`
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

  const idToMovement = new Map(transferMovements.map((m) => [m.id, m]));

  for (const [refId, list] of byRefId) {
    if (list.length === 2) {
      const [a, b] = list;
      const qA = Number(a.quantity);
      const qB = Number(b.quantity);
      const oneIn = a.movementType === 'IN' && b.movementType === 'OUT';
      const oneOut = a.movementType === 'OUT' && b.movementType === 'IN';
      if (!(oneIn || oneOut)) {
        errors.push(
          `Transfer referenceId=${refId}: expected one IN and one OUT, got ${a.movementType} and ${b.movementType}`
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
      continue;
    }
    if (list.length === 1) {
      const m = list[0]!;
      if (m.referenceId === null && m.movementType === 'OUT') {
        const inLeg = transferMovements.find(
          (x) =>
            x.referenceId === m.id &&
            x.movementType === 'IN' &&
            x.productId === m.productId &&
            Math.abs(Number(x.quantity) - Number(m.quantity)) <= DECIMAL_TOLERANCE
        );
        if (inLeg) continue;
      }
      if (m.referenceId != null && m.movementType === 'IN') {
        const outLeg = idToMovement.get(m.referenceId);
        if (
          outLeg &&
          outLeg.movementType === 'OUT' &&
          outLeg.productId === m.productId &&
          Math.abs(Number(outLeg.quantity) - Number(m.quantity)) <= DECIMAL_TOLERANCE
        ) {
          continue;
        }
      }
    }
    errors.push(
      `Transfer referenceId=${refId}: expected exactly 2 movements (or legacy pair), got ${list.length}`
    );
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
          `Negative balance (productId=${b.productId}, warehouseId=${b.warehouseId}): quantity=${q} but allowNegativeStock=false`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
