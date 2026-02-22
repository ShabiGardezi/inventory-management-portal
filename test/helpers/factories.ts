import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/utils/password';
import { StockService } from '@/server/services/stock.service';

const TEST_PASSWORD = 'TestPassword1!';

export interface TestUser {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
  roles: string[];
}

/**
 * Create a user with the given permission names.
 * Creates role and permissions if they don't exist, then assigns role to user.
 */
export async function createUserWithPermissions(
  prisma: PrismaClient,
  permissions: string[],
  options?: { email?: string; name?: string }
): Promise<TestUser> {
  const email = options?.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.local`;
  const name = options?.name ?? 'Test User';
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const permRecords = await Promise.all(
    permissions.map((name) =>
      prisma.permission.upsert({
        where: { name },
        update: { module: 'Test' },
        create: { name, resource: name.split(':')[0] ?? 'test', action: 'read', module: 'Test' },
      })
    )
  );

  const role = await prisma.role.create({
    data: {
      name: `role-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      description: 'Test role',
      isSystem: false,
      rolePermissions: {
        create: permRecords.map((p) => ({ permissionId: p.id })),
      },
    },
    include: { rolePermissions: { include: { permission: true } } },
  });

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      isActive: true,
      userRoles: { create: [{ roleId: role.id }] },
    },
    include: {
      userRoles: {
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } },
        },
      },
    },
  });

  const perms = new Set<string>();
  user.userRoles.forEach((ur) => {
    ur.role.rolePermissions.forEach((rp) => perms.add(rp.permission.name));
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    permissions: Array.from(perms),
    roles: user.userRoles.map((ur) => ur.role.name),
  };
}

/**
 * Create a user with a single role (creates role with given permissions if provided).
 */
export async function createUserWithRole(
  prisma: PrismaClient,
  roleName: string,
  permissions: string[] = [],
  options?: { email?: string; name?: string }
): Promise<TestUser> {
  const permRecords = await Promise.all(
    permissions.map((name) =>
      prisma.permission.upsert({
        where: { name },
        update: { module: 'Test' },
        create: { name, resource: name.split(':')[0] ?? 'test', action: 'read', module: 'Test' },
      })
    )
  );
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: {
      name: roleName,
      description: `Test role ${roleName}`,
      isSystem: false,
      rolePermissions: {
        create: permRecords.map((p) => ({ permissionId: p.id })),
      },
    },
    include: { rolePermissions: { include: { permission: true } } },
  });
  const email = options?.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.local`;
  const name = options?.name ?? 'Test User';
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      isActive: true,
      userRoles: { create: [{ roleId: role.id }] },
    },
    include: {
      userRoles: {
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } },
        },
      },
    },
  });
  const perms = new Set<string>();
  user.userRoles.forEach((ur) => {
    ur.role.rolePermissions.forEach((rp) => perms.add(rp.permission.name));
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    permissions: Array.from(perms),
    roles: user.userRoles.map((ur) => ur.role.name),
  };
}

/** Enable (or create) an approval policy for the given entity type. */
export async function enableApprovalPolicy(
  prisma: PrismaClient,
  entityType: 'PURCHASE_RECEIVE' | 'SALE_CONFIRM' | 'STOCK_ADJUSTMENT' | 'STOCK_TRANSFER'
): Promise<void> {
  const existing = await prisma.approvalPolicy.findFirst({
    where: { tenantId: null, entityType },
  });
  if (existing) {
    await prisma.approvalPolicy.update({
      where: { id: existing.id },
      data: { isEnabled: true },
    });
  } else {
    await prisma.approvalPolicy.create({
      data: {
        tenantId: null,
        entityType,
        isEnabled: true,
        requiredPermission: 'approvals.review',
      },
    });
  }
}

/** Disable approval policy for entity type (for tests that need direct execution). */
export async function disableApprovalPolicy(
  prisma: PrismaClient,
  entityType: 'PURCHASE_RECEIVE' | 'SALE_CONFIRM' | 'STOCK_ADJUSTMENT' | 'STOCK_TRANSFER'
): Promise<void> {
  const existing = await prisma.approvalPolicy.findFirst({
    where: { tenantId: null, entityType },
  });
  if (existing) {
    await prisma.approvalPolicy.update({
      where: { id: existing.id },
      data: { isEnabled: false },
    });
  }
}

export async function createWarehouse(prisma: PrismaClient, name?: string): Promise<{ id: string; name: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const w = await prisma.warehouse.create({
    data: {
      name: name ?? `Warehouse ${suffix}`,
      code: `WH-${suffix}`,
      isActive: true,
    },
  });
  return { id: w.id, name: w.name };
}

export async function createProduct(
  prisma: PrismaClient,
  sku?: string,
  options?: { trackBatches?: boolean; trackSerials?: boolean }
): Promise<{ id: string; sku: string; name: string }> {
  const s = sku ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const p = await prisma.product.create({
    data: {
      sku: s,
      name: `Product ${s}`,
      unit: 'pcs',
      isActive: true,
      trackBatches: options?.trackBatches ?? false,
      trackSerials: options?.trackSerials ?? false,
    },
  });
  return { id: p.id, sku: p.sku, name: p.name };
}

/**
 * Seed stock via StockService.receivePurchase (one IN movement + balance update).
 * Use for tests that need initial stock before adjust/transfer/sale.
 */
export async function seedStock(
  prisma: PrismaClient,
  params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    userId: string;
    referenceNumber?: string;
    referenceId?: string;
  }
): Promise<void> {
  const service = new StockService(prisma);
  await service.receivePurchase({
    productId: params.productId,
    warehouseId: params.warehouseId,
    quantity: params.quantity,
    referenceNumber: params.referenceNumber ?? `PO-SEED-${Date.now()}`,
    referenceId: params.referenceId,
    createdById: params.userId,
  });
}

/** Ensure global settings exist (for allowNegativeStock). */
export async function ensureSettings(prisma: PrismaClient, allowNegativeStock = false): Promise<void> {
  const existing = await prisma.settings.findFirst({
    where: { scope: 'GLOBAL', tenantId: null },
  });
  if (existing) {
    await prisma.settings.update({
      where: { id: existing.id },
      data: { allowNegativeStock },
    });
  } else {
    await prisma.settings.create({
      data: {
        scope: 'GLOBAL',
        tenantId: null,
        allowNegativeStock,
        timezone: 'UTC',
        currency: 'USD',
        dateFormat: 'MM/dd/yyyy',
      },
    });
  }
}

export { TEST_PASSWORD };
