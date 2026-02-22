/**
 * Phase 0: Minimal roles, permissions, and users for seed (avoids timeout on Supabase).
 * Creates admin@local, manager@local, staff1@local, staff2@local, viewer@local.
 */

import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const MINIMAL_PERMISSIONS = [
  { name: 'product:read', resource: 'product', action: 'read', module: 'Products' },
  { name: 'product:create', resource: 'product', action: 'create', module: 'Products' },
  { name: 'product:update', resource: 'product', action: 'update', module: 'Products' },
  { name: 'warehouse:read', resource: 'warehouse', action: 'read', module: 'Warehouses' },
  { name: 'stock:read', resource: 'stock', action: 'read', module: 'Stock' },
  { name: 'stock:create', resource: 'stock', action: 'create', module: 'Stock' },
  { name: 'stock:transfer', resource: 'stock', action: 'transfer', module: 'Stock' },
  { name: 'stock:adjust', resource: 'stock', action: 'adjust', module: 'Stock' },
  { name: 'user:read', resource: 'user', action: 'read', module: 'Users' },
  { name: 'role:read', resource: 'role', action: 'read', module: 'Roles' },
  { name: 'audit.read', resource: 'audit', action: 'read', module: 'Audit' },
  { name: 'settings.read', resource: 'settings', action: 'read', module: 'Settings' },
  { name: 'settings.update', resource: 'settings', action: 'update', module: 'Settings' },
  { name: 'reports.read', resource: 'reports', action: 'read', module: 'Reports' },
  { name: 'approvals.read', resource: 'approvals', action: 'read', module: 'Approvals' },
  { name: 'approvals.review', resource: 'approvals', action: 'review', module: 'Approvals' },
];

export interface SeedRolesAndUsersResult {
  userIdByEmail: Map<string, string>;
  adminUserId: string;
  managerUserId: string;
  roleIds: Map<string, string>;
}

export async function createRolesAndUsers(
  prisma: PrismaClient,
  defaultPassword: string
): Promise<SeedRolesAndUsersResult> {
  const hash = await bcrypt.hash(defaultPassword, 10);

  const permIds: string[] = [];
  for (const p of MINIMAL_PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { name: p.name },
      update: { module: p.module },
      create: { name: p.name, resource: p.resource, action: p.action, module: p.module },
    });
    permIds.push(row.id);
  }

  const roleDefs = [
    { name: 'admin', description: 'Full access', isSystem: true },
    { name: 'manager', description: 'Operations and reports', isSystem: true },
    { name: 'staff', description: 'Operations', isSystem: true },
    { name: 'viewer', description: 'Read-only', isSystem: true },
  ];

  const roleIds = new Map<string, string>();
  for (const def of roleDefs) {
    const r = await prisma.role.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name, description: def.description, isSystem: def.isSystem, isActive: true },
    });
    roleIds.set(r.name, r.id);
  }

  const adminId = roleIds.get('admin')!;
  const managerId = roleIds.get('manager')!;
  const staffId = roleIds.get('staff')!;
  const viewerId = roleIds.get('viewer')!;

  await prisma.rolePermission.createMany({
    data: permIds.map((permissionId) => ({ roleId: adminId, permissionId })),
    skipDuplicates: true,
  });

  const managerPermIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  await prisma.rolePermission.createMany({
    data: managerPermIndexes.map((i) => ({ roleId: managerId, permissionId: permIds[i]! })),
    skipDuplicates: true,
  });

  const staffPermIndexes = [0, 1, 2, 3, 4, 5, 6, 7];
  await prisma.rolePermission.createMany({
    data: staffPermIndexes.map((i) => ({ roleId: staffId, permissionId: permIds[i]! })),
    skipDuplicates: true,
  });

  const viewerPermIndexes = [0, 3, 4, 8, 9, 10, 11, 12, 13];
  await prisma.rolePermission.createMany({
    data: viewerPermIndexes.map((i) => ({ roleId: viewerId, permissionId: permIds[i]! })),
    skipDuplicates: true,
  });

  const userIdByEmail = new Map<string, string>();
  const accounts: Array<{ email: string; name: string; roleName: string }> = [
    { email: 'admin@local', name: 'Admin User', roleName: 'admin' },
    { email: 'manager@local', name: 'Manager User', roleName: 'manager' },
    { email: 'staff1@local', name: 'Staff One', roleName: 'staff' },
    { email: 'staff2@local', name: 'Staff Two', roleName: 'staff' },
    { email: 'viewer@local', name: 'Viewer User', roleName: 'viewer' },
  ];

  let adminUserId = '';
  let managerUserId = '';

  for (const acc of accounts) {
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: { isActive: true },
      create: {
        email: acc.email,
        name: acc.name,
        passwordHash: hash,
        isActive: true,
        emailVerified: new Date(),
      },
    });
    userIdByEmail.set(user.email, user.id);
    if (acc.email === 'admin@local') adminUserId = user.id;
    if (acc.email === 'manager@local') managerUserId = user.id;

    const roleId = roleIds.get(acc.roleName);
    if (roleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }
  }

  return { userIdByEmail, adminUserId, managerUserId, roleIds };
}
