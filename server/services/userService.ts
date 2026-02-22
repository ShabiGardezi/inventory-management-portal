import { PrismaClient } from '@prisma/client';
import { AuditLogAction } from '@prisma/client';
import { UserRepository, UserListFilters, UserSortField, SortOrder, UserListResult, UserByIdResult } from '../repositories/userRepo';
import { createAuditLog } from './auditService';

export interface CreateUserInput {
  email: string;
  name?: string | null;
  password: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  name?: string | null;
  email?: string;
  isActive?: boolean;
}

export class UserService {
  private userRepo: UserRepository;

  constructor(private prisma: PrismaClient) {
    this.userRepo = new UserRepository(prisma);
  }

  async listUsers(
    filters: UserListFilters,
    page: number,
    pageSize: number,
    sort: UserSortField,
    order: SortOrder
  ): Promise<{ rows: UserListResult['rows']; total: number; page: number; pageSize: number }> {
    const skip = (page - 1) * pageSize;
    const { rows, total } = await this.userRepo.list(filters, skip, pageSize, sort, order);
    return { rows, total, page, pageSize };
  }

  async getUserById(id: string): Promise<UserByIdResult | null> {
    return this.userRepo.findById(id);
  }

  async createUser(
    input: CreateUserInput,
    actorUserId: string
  ): Promise<{ id: string; email: string; name: string | null; isActive: boolean; createdAt: Date }> {
    const { hashPassword } = await import('@/lib/utils/password');
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new Error('A user with this email already exists');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepo.create({
      email: input.email,
      name: input.name,
      passwordHash,
      isActive: true,
    });

    if (input.roleIds?.length) {
      await this.userRepo.setRoles(user.id, input.roleIds);
    }

    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.CREATE,
      resource: 'user',
      resourceId: user.id,
      description: `Created user: ${user.email}`,
      metadata: { email: user.email, name: user.name },
    });

    return user;
  }

  async updateUser(
    id: string,
    input: UpdateUserInput,
    actorUserId: string,
    canDisable: boolean
  ): Promise<{ id: string; email: string; name: string | null; isActive: boolean }> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new Error('User not found');
    }
    const updateData: UpdateUserInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (canDisable && input.isActive !== undefined) updateData.isActive = input.isActive;

    const user = await this.userRepo.update(id, updateData);

    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.UPDATE,
      resource: 'user',
      resourceId: id,
      description: `Updated user: ${user.email}`,
      metadata: updateData as Record<string, unknown>,
    });

    return user;
  }

  async setUserStatus(
    id: string,
    isActive: boolean,
    actorUserId: string
  ): Promise<{ id: string; isActive: boolean }> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new Error('User not found');
    }
    const result = await this.userRepo.setActive(id, isActive);
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.UPDATE,
      resource: 'user',
      resourceId: id,
      description: isActive ? `Enabled user: ${existing.email}` : `Disabled user: ${existing.email}`,
      metadata: { isActive },
    });
    return result;
  }

  async assignRoles(
    userId: string,
    roleIds: string[],
    actorUserId: string
  ): Promise<void> {
    const existing = await this.userRepo.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }
    await this.userRepo.setRoles(userId, roleIds);
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.UPDATE,
      resource: 'user',
      resourceId: userId,
      description: `Updated roles for user: ${existing.email}`,
      metadata: { roleIds },
    });
  }

  async unassignRole(
    userId: string,
    roleId: string,
    actorUserId: string
  ): Promise<void> {
    const existing = await this.userRepo.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }
    const currentRoleIds = await this.userRepo.getRoleIdsForUser(userId);
    const nextRoleIds = currentRoleIds.filter((id) => id !== roleId);
    await this.userRepo.setRoles(userId, nextRoleIds);
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.UPDATE,
      resource: 'user',
      resourceId: userId,
      description: `Unassigned role from user: ${existing.email}`,
      metadata: { roleId, roleIdsAfter: nextRoleIds },
    });
  }

  async getRoles(): Promise<{ id: string; name: string; description: string | null; isActive: boolean }[]> {
    return this.userRepo.getRoles();
  }
}
