import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createTestPrisma, resetTestDb } from './helpers/db';
import {
  createUserWithPermissions,
  createWarehouse,
  createProduct,
  seedStock,
  ensureSettings,
} from './helpers/factories';
import { StockService } from '@/server/services/stock.service';
import { runIntegrityChecks } from '@/lib/verify-integrity';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const prisma = createTestPrisma();

beforeEach(async () => {
  await resetTestDb(prisma);
  await ensureSettings(prisma, false);
});

async function mockSession(user: { id: string; email: string; name: string | null; permissions: string[]; roles: string[] }) {
  const { auth } = await import('@/auth');
  vi.mocked(auth).mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      permissions: user.permissions,
      roles: user.roles,
    },
  });
}

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
    await seedStock(prisma, {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 40,
      userId: user.id,
      referenceNumber: 'PO-INIT',
    });
    const service = new StockService(prisma);
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

describe('Batch-tracked product integration', () => {
  it('receive into batch A: movement IN has batchId, balance for batchId updated', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma, undefined, { trackBatches: true }),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    const result = await service.receivePurchase({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 10,
      referenceNumber: 'PO-BATCH-A',
      createdById: user.id,
      batchInput: {
        batchNumber: 'BATCH-A',
        expiryDate: new Date('2026-12-31'),
      },
    });
    expect(result.success).toBe(true);
    expect(result.stockMovement.movementType).toBe('IN');
    expect(Number(result.stockMovement.quantity)).toBe(10);

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'PURCHASE' },
      include: { batch: true },
    });
    expect(movement?.batchId).toBeDefined();
    expect(movement?.batch?.batchNumber).toBe('BATCH-A');

    const balance = await prisma.stockBalance.findFirst({
      where: { productId: product.id, warehouseId: warehouse.id, batchId: movement!.batchId! },
    });
    expect(balance).toBeDefined();
    expect(Number(balance!.quantity)).toBe(10);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('transfer batch A: two movements with batchId, both balances updated', async () => {
    const [user, product, whFrom, whTo] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:transfer']),
      createProduct(prisma, undefined, { trackBatches: true }),
      createWarehouse(prisma),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    await service.receivePurchase({
      productId: product.id,
      warehouseId: whFrom.id,
      quantity: 50,
      referenceNumber: 'PO-BATCH',
      createdById: user.id,
      batchInput: { batchNumber: 'BATCH-TRANSFER' },
    });
    const batch = await prisma.batch.findFirst({
      where: { productId: product.id, batchNumber: 'BATCH-TRANSFER' },
    });
    expect(batch).toBeDefined();

    const result = await service.transferStock({
      productId: product.id,
      fromWarehouseId: whFrom.id,
      toWarehouseId: whTo.id,
      quantity: 20,
      createdById: user.id,
      allowNegative: false,
      batchId: batch!.id,
    });
    expect(result.success).toBe(true);
    expect(Number(result.fromBalance.quantity)).toBe(30);
    expect(Number(result.toBalance.quantity)).toBe(20);

    const transferMovements = await prisma.stockMovement.findMany({
      where: { productId: product.id, referenceType: 'TRANSFER' },
      orderBy: { createdAt: 'asc' },
    });
    expect(transferMovements.length).toBe(2);
    expect(transferMovements[0]!.batchId).toBe(batch!.id);
    expect(transferMovements[1]!.batchId).toBe(batch!.id);
    expect(transferMovements[0]!.referenceId).toBe(transferMovements[1]!.referenceId);

    const fromBalance = await prisma.stockBalance.findFirst({
      where: { productId: product.id, warehouseId: whFrom.id, batchId: batch!.id },
    });
    const toBalance = await prisma.stockBalance.findFirst({
      where: { productId: product.id, warehouseId: whTo.id, batchId: batch!.id },
    });
    expect(Number(fromBalance!.quantity)).toBe(30);
    expect(Number(toBalance!.quantity)).toBe(20);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe('Serial-tracked product integration', () => {
  it('receive with serialNumbers: serials created IN_STOCK, movement has serialCount', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma, undefined, { trackSerials: true }),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    const serials = ['SN-001', 'SN-002', 'SN-003'];
    const result = await service.receivePurchase({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: serials.length,
      referenceNumber: 'PO-SERIAL',
      createdById: user.id,
      serialNumbers: serials,
    });
    expect(result.success).toBe(true);
    expect(result.stockMovement.movementType).toBe('IN');
    expect(Number(result.stockMovement.quantity)).toBe(3);

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'PURCHASE' },
    });
    expect(movement?.serialCount).toBe(3);

    const created = await prisma.productSerial.findMany({
      where: { productId: product.id, serialNumber: { in: serials } },
    });
    expect(created.length).toBe(3);
    expect(created.every((s) => s.status === 'IN_STOCK' && s.warehouseId === warehouse.id)).toBe(true);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('transfer using serials: serial warehouse updated, movements created', async () => {
    const [user, product, whFrom, whTo] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:transfer']),
      createProduct(prisma, undefined, { trackSerials: true }),
      createWarehouse(prisma),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    const serials = ['SN-T1', 'SN-T2'];
    await service.receivePurchase({
      productId: product.id,
      warehouseId: whFrom.id,
      quantity: 2,
      referenceNumber: 'PO-SERIAL-T',
      createdById: user.id,
      serialNumbers: serials,
    });
    const result = await service.transferStock({
      productId: product.id,
      fromWarehouseId: whFrom.id,
      toWarehouseId: whTo.id,
      quantity: 2,
      createdById: user.id,
      allowNegative: false,
      serialNumbers: serials,
    });
    expect(result.success).toBe(true);
    expect(Number(result.fromBalance.quantity)).toBe(0);
    expect(Number(result.toBalance.quantity)).toBe(2);

    const after = await prisma.productSerial.findMany({
      where: { productId: product.id, serialNumber: { in: serials } },
    });
    expect(after.length).toBe(2);
    expect(after.every((s) => s.warehouseId === whTo.id && s.status === 'IN_STOCK')).toBe(true);

    const transferMovements = await prisma.stockMovement.findMany({
      where: { productId: product.id, referenceType: 'TRANSFER' },
    });
    expect(transferMovements.length).toBe(2);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('sale confirm using serials: serials marked SOLD, OUT movement created', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:read']),
      createProduct(prisma, undefined, { trackSerials: true }),
      createWarehouse(prisma),
    ]);
    const service = new StockService(prisma);
    const serials = ['SN-S1', 'SN-S2', 'SN-S3'];
    await service.receivePurchase({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 3,
      referenceNumber: 'PO-SERIAL-S',
      createdById: user.id,
      serialNumbers: serials,
    });
    const result = await service.confirmSale({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 2,
      referenceNumber: 'SO-SERIAL',
      referenceId: 'so-serial-1',
      createdById: user.id,
      serialNumbers: ['SN-S1', 'SN-S2'],
    });
    expect(result.success).toBe(true);
    expect(result.stockMovement.movementType).toBe('OUT');
    expect(Number(result.stockMovement.quantity)).toBe(2);
    expect(Number(result.stockBalance.quantity)).toBe(1);

    const outMovement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'SALE' },
    });
    expect(outMovement?.serialCount).toBe(2);

    const sold = await prisma.productSerial.findMany({
      where: { productId: product.id, serialNumber: { in: ['SN-S1', 'SN-S2'] } },
    });
    expect(sold.length).toBe(2);
    expect(sold.every((s) => s.status === 'SOLD')).toBe(true);

    const inStock = await prisma.productSerial.findFirst({
      where: { productId: product.id, serialNumber: 'SN-S3' },
    });
    expect(inStock?.status).toBe('IN_STOCK');

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe('Stock API integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /api/stock/adjust: 1 movement created, balance updated, integrity passes', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(user);

    const { POST } = await import('@/app/api/stock/adjust/route');
    const req = new NextRequest('http://localhost/api/stock/adjust', {
      method: 'POST',
      body: JSON.stringify({
        productId: product.id,
        warehouseId: warehouse.id,
        method: 'increase',
        quantity: 10,
        reason: 'correction',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    expect(movements.length).toBe(1);
    expect(movements[0]!.referenceType).toBe('ADJUSTMENT');
    expect(Number(movements[0]!.quantity)).toBe(10);

    const balance = await prisma.stockBalance.findFirst({
      where: { productId: product.id, warehouseId: warehouse.id, batchId: null },
    });
    expect(balance).toBeDefined();
    expect(Number(balance!.quantity)).toBe(10);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('POST /api/stock/transfer: 2 movements same referenceId, both balances updated, integrity passes', async () => {
    const [user, product, whFrom, whTo] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:transfer']),
      createProduct(prisma),
      createWarehouse(prisma),
      createWarehouse(prisma),
    ]);
    await seedStock(prisma, {
      productId: product.id,
      warehouseId: whFrom.id,
      quantity: 50,
      userId: user.id,
    });
    await mockSession(user);

    const { POST } = await import('@/app/api/stock/transfer/route');
    const req = new NextRequest('http://localhost/api/stock/transfer', {
      method: 'POST',
      body: JSON.stringify({
        productId: product.id,
        fromWarehouseId: whFrom.id,
        toWarehouseId: whTo.id,
        quantity: 20,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

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

    const fromBalance = await prisma.stockBalance.findFirst({
      where: { productId: product.id, warehouseId: whFrom.id, batchId: null },
    });
    const toBalance = await prisma.stockBalance.findFirst({
      where: { productId: product.id, warehouseId: whTo.id, batchId: null },
    });
    expect(Number(fromBalance!.quantity)).toBe(30);
    expect(Number(toBalance!.quantity)).toBe(20);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
});
