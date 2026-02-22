import type { PrismaClient } from '@prisma/client';

const PERMISSIONS: Array<{
  name: string;
  resource: string;
  action: string;
  description: string;
  module: string;
}> = [
  { name: 'product:create', resource: 'product', action: 'create', description: 'Create products', module: 'Products' },
  { name: 'product:read', resource: 'product', action: 'read', description: 'View products', module: 'Products' },
  { name: 'product:update', resource: 'product', action: 'update', description: 'Update products', module: 'Products' },
  { name: 'product:delete', resource: 'product', action: 'delete', description: 'Delete products', module: 'Products' },
  { name: 'warehouse:create', resource: 'warehouse', action: 'create', description: 'Create warehouses', module: 'Warehouses' },
  { name: 'warehouse:read', resource: 'warehouse', action: 'read', description: 'View warehouses', module: 'Warehouses' },
  { name: 'warehouse:update', resource: 'warehouse', action: 'update', description: 'Update warehouses', module: 'Warehouses' },
  { name: 'warehouse:delete', resource: 'warehouse', action: 'delete', description: 'Delete warehouses', module: 'Warehouses' },
  { name: 'stock:create', resource: 'stock', action: 'create', description: 'Create stock movements', module: 'Stock' },
  { name: 'stock:read', resource: 'stock', action: 'read', description: 'View stock movements and balances', module: 'Stock' },
  { name: 'stock:update', resource: 'stock', action: 'update', description: 'Update stock movements', module: 'Stock' },
  { name: 'stock:delete', resource: 'stock', action: 'delete', description: 'Delete stock movements', module: 'Stock' },
  { name: 'stock:transfer', resource: 'stock', action: 'transfer', description: 'Transfer stock between warehouses', module: 'Stock' },
  { name: 'stock:adjust', resource: 'stock', action: 'adjust', description: 'Adjust stock quantities', module: 'Stock' },
  { name: 'user:create', resource: 'user', action: 'create', description: 'Create users', module: 'Users' },
  { name: 'user:read', resource: 'user', action: 'read', description: 'View users', module: 'Users' },
  { name: 'user:update', resource: 'user', action: 'update', description: 'Update users', module: 'Users' },
  { name: 'user:delete', resource: 'user', action: 'delete', description: 'Delete users', module: 'Users' },
  { name: 'users.read', resource: 'users', action: 'read', description: 'View users list and details', module: 'Users' },
  { name: 'users.create', resource: 'users', action: 'create', description: 'Create/invite users', module: 'Users' },
  { name: 'users.update', resource: 'users', action: 'update', description: 'Update user profile', module: 'Users' },
  { name: 'users.disable', resource: 'users', action: 'disable', description: 'Disable or enable users', module: 'Users' },
  { name: 'role:create', resource: 'role', action: 'create', description: 'Create roles', module: 'Roles' },
  { name: 'role:read', resource: 'role', action: 'read', description: 'View roles', module: 'Roles' },
  { name: 'role:update', resource: 'role', action: 'update', description: 'Update roles', module: 'Roles' },
  { name: 'role:delete', resource: 'role', action: 'delete', description: 'Delete roles', module: 'Roles' },
  { name: 'role:assign', resource: 'role', action: 'assign', description: 'Assign roles to users', module: 'Roles' },
  { name: 'roles.read', resource: 'roles', action: 'read', description: 'View roles', module: 'Roles' },
  { name: 'roles.assign', resource: 'roles', action: 'assign', description: 'Assign roles to users', module: 'Roles' },
  { name: 'roles.manage', resource: 'roles', action: 'manage', description: 'Manage roles and permissions', module: 'Roles' },
  { name: 'audit:read', resource: 'audit', action: 'read', description: 'View audit logs (legacy)', module: 'Audit' },
  { name: 'audit.read', resource: 'audit', action: 'read', description: 'View audit logs', module: 'Audit' },
  { name: 'settings.read', resource: 'settings', action: 'read', description: 'View system and organization settings', module: 'Settings' },
  { name: 'settings.update', resource: 'settings', action: 'update', description: 'Update system and organization settings', module: 'Settings' },
  { name: 'inventory:read', resource: 'inventory', action: 'read', description: 'View inventory levels', module: 'Products' },
  { name: 'inventory.read', resource: 'inventory', action: 'read', description: 'View inventory (reports)', module: 'Reports' },
  { name: 'reports:read', resource: 'reports', action: 'read', description: 'View reports', module: 'Reports' },
  { name: 'reports.read', resource: 'reports', action: 'read', description: 'View reports', module: 'Reports' },
  { name: 'warehouse.read', resource: 'warehouse', action: 'read', description: 'View warehouses (reports filter)', module: 'Reports' },
  { name: 'purchase.read', resource: 'purchase', action: 'read', description: 'View purchase reports', module: 'Purchases' },
  { name: 'sales.read', resource: 'sales', action: 'read', description: 'View sales reports', module: 'Sales' },
  { name: 'export.read', resource: 'export', action: 'read', description: 'Export reports to CSV', module: 'Reports' },
];

export interface PermissionRecord {
  id: string;
  name: string;
  resource: string;
  action: string;
  module: string | null;
}

export interface SeedRolesResult {
  permissions: PermissionRecord[];
  roles: Array<{ id: string; name: string }>;
}

export async function seedPermissions(prisma: PrismaClient): Promise<PermissionRecord[]> {
  const created = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { name: p.name },
        update: { module: p.module },
        create: p,
      })
    )
  );
  return created.map((c) => ({
    id: c.id,
    name: c.name,
    resource: c.resource,
    action: c.action,
    module: c.module,
  }));
}

const SYSTEM_ROLES = [
  { name: 'admin', description: 'Full system access', isSystem: true },
  { name: 'manager', description: 'Inventory management access', isSystem: true },
  { name: 'staff', description: 'Basic inventory operations', isSystem: true },
  { name: 'viewer', description: 'Read-only access', isSystem: true },
];

const CUSTOM_ROLE_NAMES = [
  'inventory_clerk',
  'warehouse_lead',
  'procurement',
  'sales_rep',
  'reports_only',
];

export async function seedRoles(
  prisma: PrismaClient,
  permissions: PermissionRecord[]
): Promise<Array<{ id: string; name: string }>> {
  const allRoleDefs = [
    ...SYSTEM_ROLES,
    ...CUSTOM_ROLE_NAMES.map((name) => ({
      name,
      description: `Custom role: ${name.replace(/_/g, ' ')}`,
      isSystem: false,
    })),
  ];

  const roles: Array<{ id: string; name: string }> = [];
  for (const def of allRoleDefs) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      update: { isSystem: def.isSystem },
      create: {
        name: def.name,
        description: def.description,
        isSystem: def.isSystem,
        isActive: true,
      },
    });
    roles.push({ id: role.id, name: role.name });
  }

  const permByName = new Map(permissions.map((p) => [p.name, p.id]));

  // Admin: all permissions
  const adminRole = roles.find((r) => r.name === 'admin')!;
  for (const p of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: p.id },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  // Manager: product, warehouse, stock, inventory, reports, purchase, sales, export, audit, users, roles, settings
  const managerResources = [
    'product', 'warehouse', 'stock', 'inventory', 'reports', 'purchase', 'sales', 'export',
    'audit', 'users', 'roles', 'settings', 'warehouse',
  ];
  const managerRole = roles.find((r) => r.name === 'manager')!;
  const managerPerms = permissions.filter(
    (p) =>
      managerResources.some((r) => p.name.startsWith(r + ':') || p.name.startsWith(r + '.')) ||
      p.name === 'audit:read' ||
      p.name === 'audit.read'
  );
  for (const p of managerPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: managerRole.id, permissionId: p.id },
      },
      update: {},
      create: { roleId: managerRole.id, permissionId: p.id },
    });
  }

  // Staff: product read/create; stock read/create/transfer
  const staffRole = roles.find((r) => r.name === 'staff')!;
  const staffPermNames = [
    'product:read', 'product:create',
    'stock:read', 'stock:create', 'stock:transfer',
  ];
  for (const name of staffPermNames) {
    const pid = permByName.get(name);
    if (pid) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: staffRole.id, permissionId: pid },
        },
        update: {},
        create: { roleId: staffRole.id, permissionId: pid },
      });
    }
  }

  // Viewer: all read
  const viewerRole = roles.find((r) => r.name === 'viewer')!;
  const viewerPerms = permissions.filter((p) => p.action === 'read' || p.name.includes('.read'));
  for (const p of viewerPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: viewerRole.id, permissionId: p.id },
      },
      update: {},
      create: { roleId: viewerRole.id, permissionId: p.id },
    });
  }

  // Custom roles: assign subset of permissions (read-heavy)
  for (const roleName of CUSTOM_ROLE_NAMES) {
    const role = roles.find((r) => r.name === roleName)!;
    const perms = permissions.filter(
      (p) =>
        p.action === 'read' ||
        p.name.endsWith('.read') ||
        (roleName === 'inventory_clerk' && (p.resource === 'product' || p.resource === 'stock')) ||
        (roleName === 'warehouse_lead' && (p.resource === 'warehouse' || p.resource === 'stock')) ||
        (roleName === 'procurement' && p.resource === 'purchase') ||
        (roleName === 'sales_rep' && p.resource === 'sales') ||
        (roleName === 'reports_only' && (p.module === 'Reports' || p.resource === 'reports'))
    );
    for (const p of perms.slice(0, 15)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: p.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      });
    }
  }

  return roles;
}
