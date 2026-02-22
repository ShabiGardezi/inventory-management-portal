import { PrismaClient } from '@prisma/client';

export interface RoleListRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  usersCount: number;
  permissionsCount: number;
}

export interface RoleDetailResult {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  usersCount: number;
  permissions: { id: string; name: string; description: string | null; module: string | null }[];
}

export interface RoleAssignedUserRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: Date;
}

export type RoleSortField = 'name' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export class RoleRepository {
  constructor(private prisma: PrismaClient) {}

  async list(
    search: string | undefined,
    skip: number,
    take: number,
    sort: RoleSortField,
    order: SortOrder
  ): Promise<{ rows: RoleListRow[]; total: number }> {
    const where = search?.trim()
      ? { name: { contains: search.trim(), mode: 'insensitive' as const } }
      : {};
    const orderBy = sort === 'name' ? { name: order } : { updatedAt: order };

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: { userRoles: true, rolePermissions: true },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    const rows: RoleListRow[] = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      usersCount: r._count.userRoles,
      permissionsCount: r._count.rolePermissions,
    }));
    return { rows, total };
  }

  async findById(id: string): Promise<RoleDetailResult | null> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: {
          include: {
            permission: {
              select: { id: true, name: true, description: true, module: true },
            },
          },
        },
      },
    });
    if (!role) return null;
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      usersCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        description: rp.permission.description,
        module: rp.permission.module,
      })),
    };
  }

  async findByName(name: string): Promise<{ id: string; name: string } | null> {
    const role = await this.prisma.role.findUnique({
      where: { name: name.trim() },
      select: { id: true, name: true },
    });
    return role;
  }

  async create(data: {
    name: string;
    description?: string | null;
    isSystem?: boolean;
  }): Promise<{ id: string; name: string; description: string | null; isSystem: boolean; createdAt: Date; updatedAt: Date }> {
    const role = await this.prisma.role.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
        isSystem: data.isSystem ?? false,
        isActive: true,
      },
      select: { id: true, name: true, description: true, isSystem: true, createdAt: true, updatedAt: true },
    });
    return role;
  }

  async update(
    id: string,
    data: { name?: string; description?: string | null }
  ): Promise<{ id: string; name: string; description: string | null }> {
    const payload: { name?: string; description?: string | null } = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description?.trim() ?? null;
    const role = await this.prisma.role.update({
      where: { id },
      data: payload,
      select: { id: true, name: true, description: true },
    });
    return role;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }

  async setPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(permissionIds.length > 0
        ? [
            this.prisma.rolePermission.createMany({
              data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }

  async countUsers(roleId: string): Promise<number> {
    return this.prisma.userRole.count({ where: { roleId } });
  }

  async getAssignedUsers(roleId: string): Promise<RoleAssignedUserRow[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true, createdAt: true },
        },
      },
    });
    return userRoles.map((ur) => ({
      id: ur.user.id,
      name: ur.user.name,
      email: ur.user.email,
      isActive: ur.user.isActive,
      createdAt: ur.user.createdAt,
    }));
  }
}
