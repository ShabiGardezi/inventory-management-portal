import { Prisma, PrismaClient } from '@prisma/client';

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface UserListFilters {
  q?: string;
  roleId?: string;
  status?: 'active' | 'disabled';
}

export type UserSortField = 'name' | 'email' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface UserListRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: { id: string; name: string }[];
}

export interface UserListResult {
  rows: UserListRow[];
  total: number;
}

export interface UserByIdResult {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userRoles: { roleId: string; role: { id: string; name: string } }[];
}

export class UserRepository {
  constructor(private prisma: PrismaClient | PrismaTx) {}

  private buildWhere(filters: UserListFilters): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (filters.status === 'active') where.isActive = true;
    if (filters.status === 'disabled') where.isActive = false;
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (filters.roleId) {
      where.userRoles = { some: { roleId: filters.roleId } };
    }
    return where;
  }

  async list(
    filters: UserListFilters,
    skip: number,
    take: number,
    sort: UserSortField,
    order: SortOrder
  ): Promise<UserListResult> {
    const where = this.buildWhere(filters);
    const orderBy: Prisma.UserOrderByWithRelationInput =
      sort === 'name'
        ? { name: order }
        : sort === 'email'
          ? { email: order }
          : { createdAt: order };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            select: { role: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const rows: UserListRow[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      roles: u.userRoles.map((ur) => ur.role),
    }));

    return { rows, total };
  }

  async findById(id: string): Promise<UserByIdResult | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            roleId: true,
            role: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) return null;
    return user as UserByIdResult;
  }

  async findByEmail(email: string): Promise<{ id: string; email: string; name: string | null; passwordHash: string; isActive: boolean } | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, name: true, passwordHash: true, isActive: true },
    });
  }

  async create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
    isActive?: boolean;
  }): Promise<{ id: string; email: string; name: string | null; isActive: boolean; createdAt: Date }> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name?.trim() ?? null,
        passwordHash: data.passwordHash,
        isActive: data.isActive ?? true,
      },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });
    return user;
  }

  async update(
    id: string,
    data: { name?: string | null; email?: string; isActive?: boolean }
  ): Promise<{ id: string; email: string; name: string | null; isActive: boolean }> {
    const payload: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) payload.name = data.name?.trim() ?? null;
    if (data.email !== undefined) payload.email = data.email.toLowerCase().trim();
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    const user = await this.prisma.user.update({
      where: { id },
      data: payload,
      select: { id: true, email: true, name: true, isActive: true },
    });
    return user;
  }

  async setActive(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, isActive: true },
    });
  }

  async setRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.userRole.deleteMany({ where: { userId } });
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
        skipDuplicates: true,
      });
    }
  }

  async getRoleIdsForUser(userId: string): Promise<string[]> {
    const ur = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    return ur.map((r) => r.roleId);
  }

  async getRoles(): Promise<{ id: string; name: string; description: string | null; isActive: boolean }[]> {
    return this.prisma.role.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
