import { PrismaClient } from '@prisma/client';
import { AuditLogAction } from '@prisma/client';
import { RoleRepository } from '../repositories/roleRepo';
import { PermissionRepository } from '../repositories/permissionRepo';
import { createAuditLog } from './auditService';
import type { RoleListRow, RoleDetailResult, RoleAssignedUserRow } from '../repositories/roleRepo';
import type { PermissionsByModule } from '../repositories/permissionRepo';
import type { RoleSortField } from '../repositories/roleRepo';
import type { SortOrder } from '../repositories/userRepo';

export interface CreateRoleInput {
  name: string;
  description?: string | null;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
}

export class RoleService {
  private roleRepo: RoleRepository;
  private permissionRepo: PermissionRepository;

  constructor(private prisma: PrismaClient) {
    this.roleRepo = new RoleRepository(prisma);
    this.permissionRepo = new PermissionRepository(prisma);
  }

  async listRoles(
    search: string | undefined,
    page: number,
    pageSize: number,
    sort: RoleSortField,
    order: SortOrder
  ): Promise<{ rows: RoleListRow[]; total: number; page: number; pageSize: number }> {
    const skip = (page - 1) * pageSize;
    const { rows, total } = await this.roleRepo.list(search, skip, pageSize, sort, order);
    return { rows, total, page, pageSize };
  }

  async getRoleById(id: string): Promise<RoleDetailResult | null> {
    return this.roleRepo.findById(id);
  }

  async createRole(input: CreateRoleInput, actorUserId: string): Promise<RoleListRow> {
    const existing = await this.roleRepo.findByName(input.name);
    if (existing) {
      throw new Error('A role with this name already exists');
    }
    const role = await this.roleRepo.create({
      name: input.name,
      description: input.description,
      isSystem: false,
    });
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.CREATE,
      resource: 'role',
      resourceId: role.id,
      description: `Created role: ${role.name}`,
      metadata: { name: role.name, description: role.description },
    });
    const detail = await this.roleRepo.findById(role.id);
    if (!detail) throw new Error('Role not found after create');
    return {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      isSystem: detail.isSystem,
      isActive: detail.isActive,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      usersCount: detail.usersCount,
      permissionsCount: detail.permissions.length,
    };
  }

  async updateRole(
    id: string,
    input: UpdateRoleInput,
    actorUserId: string
  ): Promise<{ id: string; name: string; description: string | null }> {
    const existing = await this.roleRepo.findById(id);
    if (!existing) {
      throw new Error('Role not found');
    }
    if (input.name !== undefined && input.name.trim() !== existing.name) {
      const nameConflict = await this.roleRepo.findByName(input.name);
      if (nameConflict && nameConflict.id !== id) {
        throw new Error('A role with this name already exists');
      }
    }
    const updated = await this.roleRepo.update(id, input);
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.UPDATE,
      resource: 'role',
      resourceId: id,
      description: `Updated role: ${updated.name}`,
      metadata: { name: updated.name, description: updated.description },
    });
    return updated;
  }

  async updateRolePermissions(
    roleId: string,
    permissionKeys: string[],
    actorUserId: string
  ): Promise<void> {
    const existing = await this.roleRepo.findById(roleId);
    if (!existing) {
      throw new Error('Role not found');
    }
    const permissionIds = await this.permissionRepo.findIdsByNames(permissionKeys);
    const beforeKeys = existing.permissions.map((p) => p.name);
    const added = permissionKeys.filter((k) => !beforeKeys.includes(k));
    const removed = beforeKeys.filter((k) => !permissionKeys.includes(k));

    await this.roleRepo.setPermissions(roleId, permissionIds);
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.UPDATE,
      resource: 'role',
      resourceId: roleId,
      description: `Updated permissions for role: ${existing.name}`,
      metadata: { added, removed },
    });
  }

  async deleteRole(id: string, actorUserId: string): Promise<void> {
    const existing = await this.roleRepo.findById(id);
    if (!existing) {
      throw new Error('Role not found');
    }
    if (existing.isSystem) {
      throw new Error('System roles cannot be deleted');
    }
    const usersCount = await this.roleRepo.countUsers(id);
    if (usersCount > 0) {
      throw new Error('Cannot delete role with assigned users. Unassign users first.');
    }
    await this.roleRepo.delete(id);
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.DELETE,
      resource: 'role',
      resourceId: id,
      description: `Deleted role: ${existing.name}`,
      metadata: { name: existing.name },
    });
  }

  async duplicateRole(
    sourceRoleId: string,
    newName: string,
    actorUserId: string
  ): Promise<RoleListRow> {
    const source = await this.roleRepo.findById(sourceRoleId);
    if (!source) {
      throw new Error('Source role not found');
    }
    const nameConflict = await this.roleRepo.findByName(newName);
    if (nameConflict) {
      throw new Error('A role with this name already exists');
    }
    const role = await this.roleRepo.create({
      name: newName.trim(),
      description: `${source.name} (copy)`,
      isSystem: false,
    });
    const permissionIds = (await this.permissionRepo.findIdsByNames(
      source.permissions.map((p) => p.name)
    )) as string[];
    if (permissionIds.length > 0) {
      await this.roleRepo.setPermissions(role.id, permissionIds);
    }
    await createAuditLog({
      userId: actorUserId,
      action: AuditLogAction.CREATE,
      resource: 'role',
      resourceId: role.id,
      description: `Duplicated role ${source.name} as ${role.name}`,
      metadata: { sourceRoleId, newName: role.name },
    });
    const detail = await this.roleRepo.findById(role.id);
    if (!detail) throw new Error('Role not found after duplicate');
    return {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      isSystem: detail.isSystem,
      isActive: detail.isActive,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      usersCount: 0,
      permissionsCount: detail.permissions.length,
    };
  }

  async getPermissionsGrouped(): Promise<PermissionsByModule[]> {
    return this.permissionRepo.listGroupedByModule();
  }

  async getAssignedUsers(roleId: string): Promise<RoleAssignedUserRow[]> {
    return this.roleRepo.getAssignedUsers(roleId);
  }
}
