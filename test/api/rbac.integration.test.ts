import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createTestPrisma, resetTestDb } from '../helpers/db';
import {
  createUserWithPermissions,
  createUserWithRole,
  createWarehouse,
  createProduct,
  ensureSettings,
} from '../helpers/factories';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const prisma = createTestPrisma();

beforeEach(async () => {
  await resetTestDb(prisma);
  await ensureSettings(prisma, false);
  vi.clearAllMocks();
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

describe('RBAC API 401', () => {
  it('POST /api/stock/adjust returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    vi.mocked(auth).mockResolvedValue(null);

    const { POST } = await import('@/app/api/stock/adjust/route');
    const req = new NextRequest('http://localhost/api/stock/adjust', {
      method: 'POST',
      body: JSON.stringify({
        productId: 'pid',
        warehouseId: 'wid',
        method: 'increase',
        quantity: 1,
        reason: 'correction',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/stock/transfer returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    vi.mocked(auth).mockResolvedValue(null);

    const { POST } = await import('@/app/api/stock/transfer/route');
    const req = new NextRequest('http://localhost/api/stock/transfer', {
      method: 'POST',
      body: JSON.stringify({
        productId: 'pid',
        fromWarehouseId: 'w1',
        toWarehouseId: 'w2',
        quantity: 1,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe('RBAC API 403', () => {
  it('POST /api/stock/adjust returns 403 when user lacks stock:adjust', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:read']),
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
    expect(res.status).toBe(403);
    const json = await res.json().catch(() => ({}));
    expect(json).toHaveProperty('error');
    expect(String(json.error)).toMatch(/Forbidden|stock:adjust/);
  });

  it('POST /api/stock/transfer returns 403 when user lacks stock:transfer', async () => {
    const [user, product, whFrom, whTo] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:read']),
      createProduct(prisma),
      createWarehouse(prisma),
      createWarehouse(prisma),
    ]);
    await mockSession(user);

    const { POST } = await import('@/app/api/stock/transfer/route');
    const req = new NextRequest('http://localhost/api/stock/transfer', {
      method: 'POST',
      body: JSON.stringify({
        productId: product.id,
        fromWarehouseId: whFrom.id,
        toWarehouseId: whTo.id,
        quantity: 5,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json().catch(() => ({}));
    expect(json).toHaveProperty('error');
    expect(String(json.error)).toMatch(/Forbidden|stock:transfer/);
  });

  it('GET /api/users returns 403 when user lacks users.read / user:read', async () => {
    const user = await createUserWithPermissions(prisma, ['product:read']);
    await mockSession(user);

    const { GET } = await import('@/app/api/users/route');
    const req = new NextRequest('http://localhost/api/users');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('GET /api/roles returns 403 when user lacks roles.read / roles.manage', async () => {
    const user = await createUserWithPermissions(prisma, ['product:read']);
    await mockSession(user);

    const { GET } = await import('@/app/api/roles/route');
    const req = new NextRequest('http://localhost/api/roles');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('GET /api/settings returns 403 when user lacks settings.read', async () => {
    const user = await createUserWithPermissions(prisma, ['product:read']);
    await mockSession(user);

    const { GET } = await import('@/app/api/settings/route');
    const req = new NextRequest('http://localhost/api/settings');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('POST /api/stock/adjust returns 201 when user has stock:adjust', async () => {
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
  });
});
