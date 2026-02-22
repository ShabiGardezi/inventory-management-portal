import { describe, it, expect, beforeEach } from 'vitest';
import { createTestPrisma, resetTestDb } from './helpers/db';
import {
  createUserWithPermissions,
  createWarehouse,
  createProduct,
  ensureSettings,
} from './helpers/factories';
import { StockService } from '@/server/services/stock.service';
import { runIntegrityChecks } from '@/lib/verify-integrity';

const prisma = createTestPrisma();

beforeEach(async () => {
  await resetTestDb(prisma);
  await ensureSettings(prisma, false);
});

describe('StockService integration', () => {
  it('adjust stock: 1 movement created, balance updated, verify-integrity passes', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    const result = await service.adjustStock({
      productId: product.id,
      warehouseId: warehouse.id,
      method: 'increase',
      quantity: 10,
      reason: 'correction',
      createdById: user.id,
      allowNegative: false,
    });
    expect(result.success).toBe(true);
    expect(result.stockMovement).toBeDefined();
    expect(result.stockMovement.movementType).toBe('IN');
    expect(Number(result.stockMovement.quantity)).toBe(10);
    expect(Number(result.stockBalance.quantity)).toBe(10);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    expect(movements.length).toBe(1);
    expect(movements[0]!.referenceType).toBe('ADJUSTMENT');

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('transfer stock: 2 movements same referenceId, both balances updated, verify-integrity passes', async () => {
    const [user, product, whFrom, whTo] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:transfer']),
      createProduct(prisma),
      createWarehouse(prisma),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    await service.adjustStock({
      productId: product.id,
      warehouseId: whFrom.id,
      method: 'increase',
      quantity: 50,
      reason: 'opening_stock',
      createdById: user.id,
    });
    const result = await service.transferStock({
      productId: product.id,
      fromWarehouseId: whFrom.id,
      toWarehouseId: whTo.id,
      quantity: 20,
      createdById: user.id,
      allowNegative: false,
    });
    expect(result.success).toBe(true);
    expect(result.fromBalance).toBeDefined();
    expect(result.toBalance).toBeDefined();
    expect(Number(result.fromBalance.quantity)).toBe(30);
    expect(Number(result.toBalance.quantity)).toBe(20);

    const transferMovements = await prisma.stockMovement.findMany({
      where: { productId: product.id, referenceType: 'TRANSFER' },
      orderBy: { createdAt: 'asc' },
    });
    expect(transferMovements.length).toBe(2);
    expect(transferMovements[0]!.referenceId).toBe(transferMovements[1]!.referenceId);
    expect(transferMovements[0]!.movementType).toBe('OUT');
    expect(transferMovements[1]!.movementType).toBe('IN');
    expect(Number(transferMovements[0]!.quantity)).toBe(20);
    expect(Number(transferMovements[1]!.quantity)).toBe(20);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('purchase receive: IN movements created, balances updated, verify-integrity passes', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:read']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    const result = await service.receivePurchase({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 25,
      referenceNumber: 'PO-TEST-001',
      referenceId: 'po-1',
      createdById: user.id,
    });
    expect(result.success).toBe(true);
    expect(result.stockMovement.movementType).toBe('IN');
    expect(Number(result.stockMovement.quantity)).toBe(25);
    expect(Number(result.stockBalance.quantity)).toBe(25);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'PURCHASE' },
    });
    expect(movements.length).toBe(1);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('sale confirm: OUT movements created, balances decreased, verify-integrity passes', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:read']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    await service.receivePurchase({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 40,
      referenceNumber: 'PO-INIT',
      createdById: user.id,
    });
    const result = await service.confirmSale({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 15,
      referenceNumber: 'SO-TEST-001',
      referenceId: 'so-1',
      createdById: user.id,
    });
    expect(result.success).toBe(true);
    expect(result.stockMovement.movementType).toBe('OUT');
    expect(Number(result.stockMovement.quantity)).toBe(15);
    expect(Number(result.stockBalance.quantity)).toBe(25);

    const outMovements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'SALE' },
    });
    expect(outMovements.length).toBe(1);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
});
