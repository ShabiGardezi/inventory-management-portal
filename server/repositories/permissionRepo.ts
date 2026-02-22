import { PrismaClient } from '@prisma/client';

export interface PermissionRow {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  module: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionsByModule {
  module: string;
  permissions: PermissionRow[];
}

export class PermissionRepository {
  constructor(private prisma: PrismaClient) {}

  async listAll(): Promise<PermissionRow[]> {
    const list = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        resource: true,
        action: true,
        module: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return list as PermissionRow[];
  }

  async listGroupedByModule(): Promise<PermissionsByModule[]> {
    const list = await this.listAll();
    const byModule = new Map<string, PermissionRow[]>();
    for (const p of list) {
      const module = p.module ?? 'Other';
      if (!byModule.has(module)) byModule.set(module, []);
      byModule.get(module)!.push(p);
    }
    const order = [
      'Dashboard',
      'Products',
      'Warehouses',
      'Stock',
      'Purchases',
      'Sales',
      'Reports',
      'Users',
      'Roles',
      'Settings',
      'Audit',
      'Other',
    ];
    const result: PermissionsByModule[] = [];
    const seen = new Set<string>();
    for (const mod of order) {
      const perms = byModule.get(mod);
      if (perms?.length) {
        result.push({ module: mod, permissions: perms });
        seen.add(mod);
      }
    }
    for (const [mod, perms] of byModule) {
      if (!seen.has(mod)) result.push({ module: mod, permissions: perms });
    }
    return result;
  }

  async findIdsByNames(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const list = await this.prisma.permission.findMany({
      where: { name: { in: keys } },
      select: { id: true },
    });
    return list.map((p) => p.id);
  }

  async findById(id: string): Promise<PermissionRow | null> {
    const p = await this.prisma.permission.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        resource: true,
        action: true,
        module: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return p as PermissionRow | null;
  }
}
