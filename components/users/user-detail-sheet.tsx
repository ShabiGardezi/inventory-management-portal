'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface UserDetail {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
  roles: { id: string; name: string }[];
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface AuditRow {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  createdAt: string;
}

interface MovementRow {
  id: string;
  createdAt: string;
  movementType: string;
  quantity: string;
  referenceNumber: string | null;
  product: { name: string; sku: string };
  warehouse: { name: string };
}

interface UserDetailSheetProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  permissions: {
    auditRead: boolean;
    rolesAssign: boolean;
    inventoryRead: boolean;
  };
}

export function UserDetailSheet({
  userId,
  open,
  onOpenChange,
  onUpdate,
  permissions,
}: UserDetailSheetProps) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setUser(data);
      setSelectedRoleIds(data.roles?.map((r: { id: string }) => r.id) ?? []);
    } catch {
      setUser(null);
    }
  }, [userId]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles?pageSize=100');
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.rows ?? []);
      setRoles(list);
    } catch {
      setRoles([]);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    if (!permissions.auditRead || !userId) return;
    try {
      const res = await fetch(`/api/users/${userId}/audit?pageSize=10`);
      if (!res.ok) return;
      const data = await res.json();
      setAuditRows(data.rows ?? []);
    } catch {
      setAuditRows([]);
    }
  }, [userId, permissions.auditRead]);

  const fetchMovements = useCallback(async () => {
    if (!permissions.inventoryRead || !userId) return;
    try {
      const res = await fetch(`/api/stock/movements?performedBy=${userId}&pageSize=10`);
      if (!res.ok) return;
      const data = await res.json();
      setMovements(data.rows ?? []);
    } catch {
      setMovements([]);
    }
  }, [userId, permissions.inventoryRead]);

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      Promise.all([
        fetchUser(),
        permissions.rolesAssign ? fetchRoles() : Promise.resolve(),
        permissions.auditRead ? fetchAudit() : Promise.resolve(),
        permissions.inventoryRead ? fetchMovements() : Promise.resolve(),
      ]).finally(() => setLoading(false));
    }
  }, [open, userId, permissions.rolesAssign, permissions.auditRead, permissions.inventoryRead, fetchUser, fetchRoles, fetchAudit, fetchMovements]);

  const saveRoles = async () => {
    if (!permissions.rolesAssign || !userId) return;
    setRolesSaving(true);
    try {
      const res = await fetch('/api/roles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleIds: selectedRoleIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to assign roles');
      toast({ title: 'Success', description: 'Roles updated.' });
      fetchUser();
      onUpdate();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to assign roles',
        variant: 'destructive',
      });
    } finally {
      setRolesSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>User details</SheetTitle>
          <SheetDescription>Profile, roles, activity, and audit log.</SheetDescription>
        </SheetHeader>
        {loading && !user ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : user ? (
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Profile</h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {user.name ?? '—'}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {user.email}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <Badge variant={user.isActive ? 'success' : 'muted'}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(user.createdAt).toLocaleString()}
                </div>
              </dl>
            </div>

            {permissions.rolesAssign && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Role assignment</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roles.length > 0 ? (
                    <>
                      <Select
                        value={selectedRoleIds[0] ?? ''}
                        onValueChange={(v) => {
                          const next = v ? [v] : [];
                          setSelectedRoleIds(next);
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={saveRoles} disabled={rolesSaving}>
                        {rolesSaving ? 'Saving...' : 'Save roles'}
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No roles available.</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current: {user.roles.length ? user.roles.map((r) => r.name).join(', ') : 'None'}
                </p>
              </div>
            )}

            {permissions.inventoryRead && movements.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Recent stock movements</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {movements.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      {m.movementType} {m.quantity} × {m.product?.name ?? m.product?.sku} @ {m.warehouse?.name}
                      {' — '}
                      {new Date(m.createdAt).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {permissions.auditRead && auditRows.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Audit log</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {auditRows.map((log) => (
                    <li key={log.id}>
                      <span className="font-medium">{log.action}</span> {log.description ?? log.resource}
                      {' — '}
                      {new Date(log.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">User not found.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
