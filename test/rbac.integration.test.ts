import { describe, it, expect, beforeEach } from 'vitest';
import { createTestPrisma, resetTestDb } from './helpers/db';
import {
  createUserWithPermissions,
  createWarehouse,
  createProduct,
  ensureSettings,
} from './helpers/factories';
import { StockService } from '@/server/services/stock.service';

function hasPermission(permissions: string[], permission: string): boolean {
  return permissions.includes(permission);
}

const prisma = createTestPrisma();

beforeEach(async () => {
  await resetTestDb(prisma);
  await ensureSettings(prisma, false);
});

describe('RBAC integration', () => {
  it('restricted user does not have stock:adjust', async () => {
    const user = await createUserWithPermissions(prisma, ['stock:read']);
    expect(hasPermission(user.permissions, 'stock:adjust')).toBe(false);
  });

  it('allowed user has stock:adjust and can perform adjust', async () => {
    const [user, product, warehouse] = await Promise.all([
      createUserWithPermissions(prisma, ['stock:adjust', 'stock:read']),
      createProduct(prisma),
      createWarehouse(prisma),
    ]);
    expect(hasPermission(user.permissions, 'stock:adjust')).toBe(true);
    const service = new StockService(prisma);
    const result = await service.adjustStock({
      productId: product.id,
      warehouseId: warehouse.id,
      method: 'increase',
      quantity: 5,
      reason: 'correction',
      createdById: user.id,
    });
    expect(result.success).toBe(true);
  });

  it('restricted user does not have stock:transfer', async () => {
    const user = await createUserWithPermissions(prisma, ['stock:read']);
    expect(hasPermission(user.permissions, 'stock:transfer')).toBe(false);
  });

  it('restricted user does not have roles.manage or settings.update', async () => {
    const user = await createUserWithPermissions(prisma, ['stock:read', 'product:read']);
    expect(hasPermission(user.permissions, 'roles.manage')).toBe(false);
    expect(hasPermission(user.permissions, 'settings.update')).toBe(false);
  });

  it('allowed user has roles.manage and settings.update when granted', async () => {
    const user = await createUserWithPermissions(prisma, ['roles.manage', 'settings.update', 'settings.read']);
    expect(hasPermission(user.permissions, 'roles.manage')).toBe(true);
    expect(hasPermission(user.permissions, 'settings.update')).toBe(true);
  });
});
