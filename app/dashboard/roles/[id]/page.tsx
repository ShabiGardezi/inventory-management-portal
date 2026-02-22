'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Shield,
  Save,
  Search,
  UserPlus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/format';

interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
  permissions: { id: string; name: string; description: string | null; module: string | null }[];
}

interface PermissionGroup {
  module: string;
  permissions: { id: string; name: string; description: string | null; module: string | null }[];
}

interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export default function RoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data: session } = useSession();
  const { toast } = useToast();
  const permissions: string[] = (session?.user as { permissions?: string[] })?.permissions ?? [];

  const canRead = permissions.includes('roles.read') || permissions.includes('roles.manage');
  const canManage = permissions.includes('roles.manage');
  const canAssign = permissions.includes('roles.assign');
  const canUsersRead = permissions.includes('users.read');
  const canAuditRead = permissions.includes('audit.read');

  const [role, setRole] = useState<RoleDetail | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permSearch, setPermSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [savingPerms, setSavingPerms] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [adminWarningOpen, setAdminWarningOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [usersForAssign, setUsersForAssign] = useState<{ id: string; name: string | null; email: string; roles: { id: string }[] }[]>([]);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  const isAdminRole = role?.name?.toLowerCase() === 'admin' && role?.isSystem;

  const fetchRole = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      const res = await fetch(`/api/roles/${id}`);
      if (res.status === 404) {
        setError('Role not found');
        setRole(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load role');
      setRole(data);
      setSelectedKeys(new Set(data.permissions?.map((p: { name: string }) => p.name) ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load role');
      setRole(null);
    }
  }, [id]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions');
      if (!res.ok) return;
      const data = await res.json();
      setGroups(data);
    } catch {
      setGroups([]);
    }
  }, []);

  const fetchAssignedUsers = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      const res = await fetch(`/api/roles/${id}/users`);
      if (!res.ok) return;
      const data = await res.json();
      setAssignedUsers(data);
    } catch {
      setAssignedUsers([]);
    }
  }, [id]);

  useEffect(() => {
    if (!canRead || !id || id === 'new') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([fetchRole(), fetchGroups()]).finally(() => setLoading(false));
  }, [canRead, id, fetchRole, fetchGroups]);

  useEffect(() => {
    if (id && id !== 'new') fetchAssignedUsers();
  }, [id, fetchAssignedUsers]);

  const filteredGroups = useMemo(() => {
    if (!permSearch.trim()) return groups;
    const q = permSearch.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [groups, permSearch]);

  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const togglePermission = (key: string) => {
    if (!canManage) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllInModule = (module: string) => {
    if (!canManage) return;
    const g = groups.find((x) => x.module === module);
    if (!g) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      g.permissions.forEach((p) => next.add(p.name));
      return next;
    });
  };

  const clearAllInModule = (module: string) => {
    if (!canManage) return;
    const g = groups.find((x) => x.module === module);
    if (!g) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      g.permissions.forEach((p) => next.delete(p.name));
      return next;
    });
  };

  const pendingAdded = useMemo(() => {
    if (!role) return [];
    const current = new Set(role.permissions?.map((p) => p.name) ?? []);
    return [...selectedKeys].filter((k) => !current.has(k));
  }, [role, selectedKeys]);

  const actualRemoved = useMemo(() => {
    if (!role) return [];
    const current = new Set(role.permissions?.map((p) => p.name) ?? []);
    return [...current].filter((k) => !selectedKeys.has(k));
  }, [role, selectedKeys]);

  const hasPermissionChanges = pendingAdded.length > 0 || actualRemoved.length > 0;

  const openSaveConfirm = () => {
    if (isAdminRole) {
      setAdminWarningOpen(true);
    } else {
      setConfirmModalOpen(true);
    }
  };

  const doSavePermissions = useCallback(async () => {
    if (!id || id === 'new' || !canManage) return;
    setSavingPerms(true);
    try {
      const res = await fetch(`/api/roles/${id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionKeys: [...selectedKeys] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update permissions');
      toast({ title: 'Permissions updated', description: 'Role permissions have been saved.' });
      setConfirmModalOpen(false);
      setAdminWarningOpen(false);
      fetchRole();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update permissions',
        variant: 'destructive',
      });
    } finally {
      setSavingPerms(false);
    }
  }, [id, canManage, selectedKeys, toast, fetchRole]);

  const openAssignModal = useCallback(async () => {
    setAssignModalOpen(true);
    try {
      const res = await fetch('/api/users?pageSize=100');
      const data = await res.json();
      const list = data.rows ?? [];
      setUsersForAssign(list);
    } catch {
      setUsersForAssign([]);
    }
  }, []);

  const assignUserToRole = useCallback(
    async (userId: string) => {
      if (!id || !canAssign) return;
      setAssigningUserId(userId);
      try {
        const user = usersForAssign.find((u) => u.id === userId);
        const currentRoleIds = user?.roles?.map((r) => r.id) ?? [];
        const nextRoleIds = currentRoleIds.includes(id) ? currentRoleIds : [...currentRoleIds, id];
        const res = await fetch('/api/roles/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, roleIds: nextRoleIds }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error ?? 'Failed to assign role');
        toast({ title: 'Role assigned', description: 'User has been assigned to this role.' });
        fetchAssignedUsers();
        fetchRole();
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Failed to assign role',
          variant: 'destructive',
        });
      } finally {
        setAssigningUserId(null);
      }
    },
    [id, canAssign, usersForAssign, toast, fetchAssignedUsers, fetchRole]
  );

  const unassignUser = useCallback(
    async (userId: string) => {
      if (!id || !canAssign) return;
      try {
        const res = await fetch('/api/roles/unassign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, roleId: id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to unassign');
        toast({ title: 'Role unassigned', description: 'User has been removed from this role.' });
        fetchAssignedUsers();
        fetchRole();
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Failed to unassign',
          variant: 'destructive',
        });
      }
    },
    [id, canAssign, toast, fetchAssignedUsers, fetchRole]
  );

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Role</h1>
          <p className="text-muted-foreground">You do not have permission to view roles.</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">roles.read or roles.manage required.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/roles">Back to Roles</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (id === 'new') {
    router.replace('/dashboard/roles/new');
    return null;
  }

  if (loading && !role) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Role</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/roles">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Role</h1>
            <p className="text-muted-foreground">{error ?? 'Not found'}</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/roles">Back to Roles</Link>
        </Button>
      </div>
    );
  }

  const assignedUserIds = new Set(assignedUsers.map((u) => u.id));
  const usersNotInRole = usersForAssign.filter((u) => !assignedUserIds.has(u.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/roles">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{role.name}</h1>
              {role.isSystem ? (
                <Badge variant="secondary">System</Badge>
              ) : (
                <Badge variant="outline">Custom</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {role.usersCount} user{role.usersCount !== 1 ? 's' : ''} assigned · {role.permissions.length} permissions
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="permissions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="users">Users assigned</TabsTrigger>
          {canAuditRead && <TabsTrigger value="audit">Audit</TabsTrigger>}
        </TabsList>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                {canManage
                  ? 'Select or clear permissions by module. Changes are saved when you click Save.'
                  : 'View-only. You need roles.manage to change permissions.'}
              </CardDescription>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search permissions..."
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={openSaveConfirm}
                    disabled={!hasPermissionChanges || savingPerms}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingPerms ? 'Saving...' : 'Save permissions'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredGroups.map((g) => {
                const isExpanded = expandedModules.has(g.module) || expandedModules.size === 0;
                return (
                  <div key={g.module} className="rounded-md border">
                    <div
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 cursor-pointer"
                      onClick={() => toggleModule(g.module)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{g.module}</span>
                        <span className="text-muted-foreground text-sm">
                          ({g.permissions.filter((p) => selectedKeys.has(p.name)).length}/{g.permissions.length})
                        </span>
                      </div>
                      {canManage && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => selectAllInModule(g.module)}
                          >
                            Select all
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => clearAllInModule(g.module)}
                          >
                            Clear all
                          </Button>
                        </div>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="p-2 space-y-1">
                        {g.permissions.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(p.name)}
                              onChange={() => togglePermission(p.name)}
                              disabled={!canManage}
                              className="rounded border-input"
                            />
                            <span className="text-sm font-mono">{p.name}</span>
                            {p.description && (
                              <span className="text-muted-foreground text-xs">{p.description}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Users assigned</CardTitle>
                  <CardDescription>Users who have this role. Assign or unassign requires roles.assign and users.read.</CardDescription>
                </div>
                {canAssign && canUsersRead && (
                  <Button onClick={openAssignModal}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign users
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {assignedUsers.length === 0 ? (
                <p className="text-muted-foreground py-4">No users assigned to this role.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      {canAssign && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.name ?? '—'}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.isActive ? 'success' : 'muted'}>
                            {u.isActive ? 'Active' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(u.createdAt)}</TableCell>
                        {canAssign && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => unassignUser(u.id)}
                            >
                              Unassign
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canAuditRead && (
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit</CardTitle>
                <CardDescription>Recent changes to this role (if audit.read is enabled).</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Audit entries for this role can be viewed in the main Audit Logs page filtered by resource &quot;role&quot; and this role ID.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save permission changes?</DialogTitle>
            <DialogDescription>
              {actualRemoved.length > 0 && (
                <span className="block mt-2">
                  Removed: {actualRemoved.slice(0, 10).join(', ')}
                  {actualRemoved.length > 10 && ` and ${actualRemoved.length - 10} more`}
                </span>
              )}
              {pendingAdded.length > 0 && (
                <span className="block mt-2">
                  Added: {pendingAdded.slice(0, 10).join(', ')}
                  {pendingAdded.length > 10 && ` and ${pendingAdded.length - 10} more`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)} disabled={savingPerms}>
              Cancel
            </Button>
            <Button onClick={doSavePermissions} disabled={savingPerms}>
              {savingPerms ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminWarningOpen} onOpenChange={setAdminWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Changing Admin permissions
            </DialogTitle>
            <DialogDescription>
              Changing Admin role permissions can lock you or other admins out of critical actions. Only proceed if you are sure.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminWarningOpen(false)} disabled={savingPerms}>
              Cancel
            </Button>
            <Button onClick={doSavePermissions} disabled={savingPerms} className="bg-amber-600 hover:bg-amber-700">
              {savingPerms ? 'Saving...' : 'I understand, save anyway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign users to this role</DialogTitle>
            <DialogDescription>
              Select a user to add them to this role. Users already assigned are not listed.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {usersNotInRole.length === 0 ? (
              <p className="text-muted-foreground py-4">All users are already assigned to this role, or no users exist.</p>
            ) : (
              usersNotInRole.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{u.name ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={assigningUserId === u.id}
                    onClick={() => assignUserToRole(u.id)}
                  >
                    {assigningUserId === u.id ? 'Assigning...' : 'Assign'}
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
