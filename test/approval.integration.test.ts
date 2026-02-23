import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createTestPrisma, resetTestDb } from './helpers/db';
import {
  createUserWithPermissions,
  createWarehouse,
  createProduct,
  seedStock,
  ensureSettings,
  enableApprovalPolicy,
  disableApprovalPolicy,
} from './helpers/factories';
import { runIntegrityChecks } from '@/lib/verify-integrity';
import { StockService } from '@/server/services/stock.service';

type MockAuthSession = {
  user: {
    id: string;
    email: string;
    name: string | null;
    permissions: string[];
    roles: string[];
  };
};

vi.mock('@/auth', () => ({
  auth: vi.fn<() => Promise<MockAuthSession | null>>(),
}));

const prisma = createTestPrisma();

beforeEach(async () => {
  await resetTestDb(prisma);
  await ensureSettings(prisma, true);
});

async function mockSession(user: {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
  roles: string[];
}) {
  const { auth } = await import('@/auth');
  const authMock = auth as unknown as {
    mockResolvedValue: (value: MockAuthSession | null) => void;
  };
  authMock.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      permissions: user.permissions,
      roles: user.roles,
    },
  });
}

describe('Approval workflow: PURCHASE_RECEIVE', () => {
  it('policy enabled: receive creates approval_request, purchase PENDING_APPROVAL, no stock_movements yet', async () => {
    await enableApprovalPolicy(prisma, 'PURCHASE_RECEIVE');
    const [requester, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(requester);

    const beforeMovements = await prisma.stockMovement.count({
      where: { productId: product.id, warehouseId: warehouse.id },
    });

    const { POST } = await import('@/app/api/purchases/receive/route');
    const req = new NextRequest('http://localhost/api/purchases/receive', {
      method: 'POST',
      body: JSON.stringify({
        referenceNumber: 'PO-APPROVAL-1',
        items: [
          { productId: product.id, warehouseId: warehouse.id, quantity: 10 },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.pendingApproval).toBe(true);
    expect(body.requestId).toBeDefined();
    expect(body.entityId).toBeDefined();

    const approvalRequests = await prisma.approvalRequest.findMany({
      where: { entityType: 'PURCHASE_RECEIVE', entityId: body.entityId },
    });
    expect(approvalRequests.length).toBe(1);
    expect(approvalRequests[0]!.status).toBe('PENDING');

    const receiveReq = await prisma.purchaseReceiveRequest.findUnique({
      where: { id: body.entityId },
    });
    expect(receiveReq).toBeDefined();
    expect(receiveReq!.status).toBe('PENDING_APPROVAL');

    const afterMovements = await prisma.stockMovement.count({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    expect(afterMovements).toBe(beforeMovements);
  });

  it('policy enabled: approve request => purchase RECEIVED, stock_movements created, integrity passes', async () => {
    await enableApprovalPolicy(prisma, 'PURCHASE_RECEIVE');
    const [requester, reviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['approvals.review']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(requester);

    const { POST: postReceive } = await import('@/app/api/purchases/receive/route');
    const receiveRes = await postReceive(
      new NextRequest('http://localhost/api/purchases/receive', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 5 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(receiveRes.status).toBe(202);
    const receiveBody = await receiveRes.json();
    const requestId = receiveBody.requestId as string;

    await mockSession(reviewer);
    const { POST: postApprove } = await import('@/app/api/approvals/[id]/approve/route');
    const approveRes = await postApprove(
      new NextRequest(`http://localhost/api/approvals/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: requestId }) }
    );
    expect(approveRes.status).toBe(200);
    const approveBody = await approveRes.json();
    expect(approveBody.executed).toBe(true);

    const receiveReq = await prisma.purchaseReceiveRequest.findUnique({
      where: { id: receiveBody.entityId },
    });
    expect(receiveReq!.status).toBe('RECEIVED');

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'PURCHASE' },
    });
    expect(movements.length).toBe(1);
    expect(Number(movements[0]!.quantity)).toBe(5);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('approving twice is idempotent: no double-apply', async () => {
    await enableApprovalPolicy(prisma, 'PURCHASE_RECEIVE');
    const [requester, reviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['approvals.review']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(requester);

    const { POST: postReceive } = await import('@/app/api/purchases/receive/route');
    const receiveRes = await postReceive(
      new NextRequest('http://localhost/api/purchases/receive', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 3 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const receiveBody = await receiveRes.json();
    const requestId = receiveBody.requestId as string;

    await mockSession(reviewer);
    const { POST: postApprove } = await import('@/app/api/approvals/[id]/approve/route');
    const params = { params: Promise.resolve({ id: requestId }) };

    const approve1 = await postApprove(
      new NextRequest(`http://localhost/api/approvals/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      params
    );
    expect(approve1.status).toBe(200);
    const body1 = await approve1.json();
    expect(body1.executed).toBe(true);

    const approve2 = await postApprove(
      new NextRequest(`http://localhost/api/approvals/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      params
    );
    expect(approve2.status).toBe(200);
    const body2 = await approve2.json();
    expect(body2.executed).toBe(false);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'PURCHASE' },
    });
    expect(movements.length).toBe(1);
    expect(Number(movements[0]!.quantity)).toBe(3);
  });
});

describe('Approval workflow: SALE_CONFIRM', () => {
  it('policy enabled: confirm creates request, sale PENDING_APPROVAL, no OUT movement yet', async () => {
    await enableApprovalPolicy(prisma, 'SALE_CONFIRM');
    const [requester, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await seedStock(prisma, {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 50,
      userId: requester.id,
    });
    await mockSession(requester);

    const beforeOut = await prisma.stockMovement.count({
      where: { productId: product.id, warehouseId: warehouse.id, movementType: 'OUT' },
    });

    const { POST } = await import('@/app/api/sales/confirm/route');
    const req = new NextRequest('http://localhost/api/sales/confirm', {
      method: 'POST',
      body: JSON.stringify({
        referenceNumber: 'SO-APPROVAL-1',
        items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 10 }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.pendingApproval).toBe(true);
    expect(body.requestId).toBeDefined();
    expect(body.entityId).toBeDefined();

    const sale = await prisma.sale.findUnique({ where: { id: body.entityId } });
    expect(sale).toBeDefined();
    expect(sale!.status).toBe('PENDING_APPROVAL');

    const afterOut = await prisma.stockMovement.count({
      where: { productId: product.id, warehouseId: warehouse.id, movementType: 'OUT' },
    });
    expect(afterOut).toBe(beforeOut);
  });

  it('policy enabled: approve => sale CONFIRMED, OUT movement created', async () => {
    await enableApprovalPolicy(prisma, 'SALE_CONFIRM');
    const [requester, reviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['approvals.review']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await seedStock(prisma, {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 100,
      userId: requester.id,
    });
    await mockSession(requester);

    const { POST: postConfirm } = await import('@/app/api/sales/confirm/route');
    const confirmRes = await postConfirm(
      new NextRequest('http://localhost/api/sales/confirm', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 20 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(confirmRes.status).toBe(202);
    const confirmBody = await confirmRes.json();
    const requestId = confirmBody.requestId as string;

    await mockSession(reviewer);
    const { POST: postApprove } = await import('@/app/api/approvals/[id]/approve/route');
    const approveRes = await postApprove(
      new NextRequest(`http://localhost/api/approvals/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: requestId }) }
    );
    expect(approveRes.status).toBe(200);

    const sale = await prisma.sale.findUnique({ where: { id: confirmBody.entityId } });
    expect(sale!.status).toBe('CONFIRMED');

    const outMovements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'SALE' },
    });
    expect(outMovements.length).toBe(1);
    expect(Number(outMovements[0]!.quantity)).toBe(20);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('policy enabled: batch/serial inputs are preserved and used during approval execution', async () => {
    await enableApprovalPolicy(prisma, 'SALE_CONFIRM');
    const [requester, reviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['approvals.review']),
      createProduct(prisma, undefined, { trackBatches: true, trackSerials: true }),
      createWarehouse(prisma),
    ]);

    const stockService = new StockService(prisma);
    const serialNumbers = ['SN-APP-1', 'SN-APP-2', 'SN-APP-3'];
    await stockService.receivePurchase({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: serialNumbers.length,
      referenceNumber: 'PO-BATCH-SERIAL-SEED',
      createdById: requester.id,
      batchInput: { batchNumber: 'BATCH-APP-1' },
      serialNumbers,
    });
    const batch = await prisma.batch.findFirst({
      where: { productId: product.id, batchNumber: 'BATCH-APP-1' },
      select: { id: true },
    });
    expect(batch?.id).toBeDefined();

    await mockSession(requester);
    const { POST: postConfirm } = await import('@/app/api/sales/confirm/route');
    const confirmRes = await postConfirm(
      new NextRequest('http://localhost/api/sales/confirm', {
        method: 'POST',
        body: JSON.stringify({
          referenceNumber: 'SO-BATCH-SERIAL-APPROVAL-1',
          items: [
            {
              productId: product.id,
              warehouseId: warehouse.id,
              quantity: serialNumbers.length,
              batchId: batch!.id,
              serialNumbers,
            },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(confirmRes.status).toBe(202);
    const confirmBody = await confirmRes.json();

    // Use raw SQL so the test doesn't depend on generated Prisma types for new columns.
    const saleItems = await prisma.$queryRaw<
      Array<{ batchId: string | null; serialNumbers: string[] }>
    >`
      SELECT "batchId", "serialNumbers"
      FROM sale_items
      WHERE "saleId" = ${confirmBody.entityId}
    `;
    expect(saleItems.length).toBe(1);
    expect(saleItems[0]!.batchId).toBe(batch!.id);
    expect(saleItems[0]!.serialNumbers).toEqual(serialNumbers);

    await mockSession(reviewer);
    const { POST: postApprove } = await import('@/app/api/approvals/[id]/approve/route');
    const approveRes = await postApprove(
      new NextRequest(`http://localhost/api/approvals/${confirmBody.requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: confirmBody.requestId }) }
    );
    expect(approveRes.status).toBe(200);

    const outMovements = await prisma.stockMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id, referenceType: 'SALE', movementType: 'OUT' },
      select: { id: true, batchId: true, serialCount: true },
    });
    expect(outMovements.length).toBe(1);
    expect(outMovements[0]!.batchId).toBe(batch!.id);
    expect(outMovements[0]!.serialCount).toBe(serialNumbers.length);

    const updatedSerials = await prisma.productSerial.findMany({
      where: { productId: product.id, serialNumber: { in: serialNumbers } },
      select: { status: true, movementId: true },
    });
    expect(updatedSerials).toHaveLength(serialNumbers.length);
    updatedSerials.forEach((s) => {
      expect(s.status).toBe('SOLD');
      expect(s.movementId).toBe(outMovements[0]!.id);
    });
  });
});

describe('Approval workflow: Reject', () => {
  it('reject request => entity REJECTED, no stock changes', async () => {
    await enableApprovalPolicy(prisma, 'PURCHASE_RECEIVE');
    const [requester, reviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['approvals.review']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(requester);

    const { POST: postReceive } = await import('@/app/api/purchases/receive/route');
    const receiveRes = await postReceive(
      new NextRequest('http://localhost/api/purchases/receive', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 7 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const receiveBody = await receiveRes.json();
    const requestId = receiveBody.requestId as string;

    const movementsBeforeReject = await prisma.stockMovement.count({
      where: { productId: product.id, warehouseId: warehouse.id },
    });

    await mockSession(reviewer);
    const { POST: postReject } = await import('@/app/api/approvals/[id]/reject/route');
    const rejectRes = await postReject(
      new NextRequest(`http://localhost/api/approvals/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment: 'Rejected in test' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: requestId }) }
    );
    expect(rejectRes.status).toBe(200);

    const approvalReq = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
    expect(approvalReq!.status).toBe('REJECTED');

    const receiveReq = await prisma.purchaseReceiveRequest.findUnique({
      where: { id: receiveBody.entityId },
    });
    expect(receiveReq!.status).toBe('REJECTED');

    const movementsAfterReject = await prisma.stockMovement.count({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    expect(movementsAfterReject).toBe(movementsBeforeReject);
  });
});

describe('Approval RBAC', () => {
  it('user without approvals.review cannot approve (403)', async () => {
    await enableApprovalPolicy(prisma, 'PURCHASE_RECEIVE');
    const [requester, noReviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['stock:adjust', 'approvals.read']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(requester);

    const { POST: postReceive } = await import('@/app/api/purchases/receive/route');
    const receiveRes = await postReceive(
      new NextRequest('http://localhost/api/purchases/receive', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const receiveBody = await receiveRes.json();
    const requestId = receiveBody.requestId as string;

    await mockSession(noReviewer);
    const { POST: postApprove } = await import('@/app/api/approvals/[id]/approve/route');
    const approveRes = await postApprove(
      new NextRequest(`http://localhost/api/approvals/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: requestId }) }
    );
    expect(approveRes.status).toBe(403);
    const json = await approveRes.json().catch(() => ({}));
    expect(json).toHaveProperty('error');
  });

  it('user without approvals.review cannot reject (403)', async () => {
    await enableApprovalPolicy(prisma, 'PURCHASE_RECEIVE');
    const [requester, noReviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['approvals.read']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(requester);

    const { POST: postReceive } = await import('@/app/api/purchases/receive/route');
    const receiveRes = await postReceive(
      new NextRequest('http://localhost/api/purchases/receive', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 1 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const receiveBody = await receiveRes.json();
    const requestId = receiveBody.requestId as string;

    await mockSession(noReviewer);
    const { POST: postReject } = await import('@/app/api/approvals/[id]/reject/route');
    const rejectRes = await postReject(
      new NextRequest(`http://localhost/api/approvals/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment: 'No' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: requestId }) }
    );
    expect(rejectRes.status).toBe(403);
  });
});

describe('Approval + integrity', () => {
  it('after approval execution, ledger matches balances (verify-integrity passes)', async () => {
    await enableApprovalPolicy(prisma, 'PURCHASE_RECEIVE');
    const [requester, reviewer, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust']),
      createUserWithPermissions(prisma, ['approvals.review']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(requester);

    const { POST: postReceive } = await import('@/app/api/purchases/receive/route');
    const receiveRes = await postReceive(
      new NextRequest('http://localhost/api/purchases/receive', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: product.id, warehouseId: warehouse.id, quantity: 11 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(receiveRes.status).toBe(202);
    const receiveBody = await receiveRes.json();

    await mockSession(reviewer);
    const { POST: postApprove } = await import('@/app/api/approvals/[id]/approve/route');
    const approveRes = await postApprove(
      new NextRequest(`http://localhost/api/approvals/${receiveBody.requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: receiveBody.requestId }) }
    );
    expect(approveRes.status).toBe(200);

    const { ok, errors } = await runIntegrityChecks(prisma);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
});
