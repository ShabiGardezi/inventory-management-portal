import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * User shape used by server services (dashboard, etc.) with permissions and roles.
 */
export interface UserWithPermissions {
  id: string;
  email: string | null;
  name: string | null;
  permissions: string[];
  roles: string[];
}

/** Check if user has a single permission (by permissions array or user object). */
export function hasPermission(
  userPermissionsOrUser: string[] | UserWithPermissions,
  permission: string
): boolean {
  const permissions = Array.isArray(userPermissionsOrUser)
    ? userPermissionsOrUser
    : (userPermissionsOrUser.permissions ?? []);
  if (!permissions.length) return false;
  return permissions.includes(permission);
}

/** Check if user has any of the given permissions. */
export function hasAnyPermission(
  userPermissions: string[] | undefined,
  permissions: string[]
): boolean {
  if (!userPermissions?.length || !permissions.length) return false;
  return permissions.some((p) => userPermissions.includes(p));
}

/** Check if user has a role (by roles array or user object). */
export function hasRole(userRolesOrUser: string[] | UserWithPermissions, role: string): boolean {
  const roles = Array.isArray(userRolesOrUser)
    ? userRolesOrUser
    : (userRolesOrUser.roles ?? []);
  return roles.includes(role);
}

function sessionToUser(session: { user: { id?: string; email?: string | null; name?: string | null; permissions?: string[]; roles?: string[] } }): UserWithPermissions {
  const u = session.user;
  return {
    id: u.id!,
    email: u.email ?? null,
    name: u.name ?? null,
    permissions: u.permissions ?? [],
    roles: u.roles ?? [],
  };
}

/** Get current session user or null if not authenticated. */
export async function getCurrentUser(): Promise<UserWithPermissions | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return sessionToUser(session);
}

/** Get current session user or throw. Used by API routes. */
export async function requireAuth(): Promise<UserWithPermissions> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Authentication required');
  }
  return sessionToUser(session);
}

/** Require at least one of the given permissions; returns user or throws. */
export async function requirePermission(permission: string): Promise<UserWithPermissions> {
  const user = await requireAuth();
  if (!hasPermission(user, permission)) {
    throw new Error(`Forbidden: ${permission} required`);
  }
  return user;
}

/** Require at least one of the given permissions; returns user or throws. */
export async function requireAnyPermission(
  permissions: string[]
): Promise<UserWithPermissions> {
  const user = await requireAuth();
  if (!hasAnyPermission(user.permissions, permissions)) {
    throw new Error(`Forbidden: one of [${permissions.join(', ')}] required`);
  }
  return user;
}

export function createSuccessResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function createErrorResponse(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
