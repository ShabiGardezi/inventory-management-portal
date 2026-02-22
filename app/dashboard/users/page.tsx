'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Users as UsersIcon,
  MoreHorizontal,
  Eye,
  Pencil,
  UserX,
  UserCheck,
  Shield,
  Download,
  Filter,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddUserDialog } from '@/components/users/add-user-dialog';
import { EditUserDialog } from '@/components/users/edit-user-dialog';
import { UserDetailSheet } from '@/components/users/user-detail-sheet';

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: { id: string; name: string }[];
}

interface UsersResponse {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const permissions: string[] = (session?.user as { permissions?: string[] })?.permissions ?? [];

  const canRead = permissions.includes('users.read');
  const canCreate = permissions.includes('users.create');
  const canUpdate = permissions.includes('users.update');
  const canDisable = permissions.includes('users.disable');
  const canAssignRole = permissions.includes('roles.assign');
  const canManageRoles = permissions.includes('roles.manage');
  const canExport = permissions.includes('users.read');

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [roleId, setRoleId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [sort, setSort] = useState<'name' | 'email' | 'createdAt'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (roleId) params.set('roleId', roleId);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sort', sort);
    params.set('order', order);
    try {
      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.status === 403) {
        setError('You do not have permission to view users.');
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error('Failed to load users');
      const data: UsersResponse = await res.json();
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canRead, q, roleId, status, page, pageSize, sort, order]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const hasRolesRead = permissions.includes('roles.read') || canAssignRole || canManageRoles;
    if (hasRolesRead) {
      fetch('/api/roles?pageSize=100')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { rows?: RoleOption[] } | RoleOption[] | null) => {
          if (!data) return;
          const list = Array.isArray(data) ? data : (data.rows ?? []);
          setRoles(list);
        })
        .catch(() => {});
    }
  }, [permissions, canAssignRole, canManageRoles]);

  const clearFilters = useCallback(() => {
    setQ('');
    setRoleId('');
    setStatus('');
    setPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (roleId) params.set('roleId', roleId);
    if (status) params.set('status', status);
    params.set('pageSize', String(Math.min(1000, total || 1000)));
    params.set('page', '1');
    params.set('sort', sort);
    params.set('order', order);
    try {
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const data: UsersResponse = await res.json();
      const headers = ['Name', 'Email', 'Roles', 'Status', 'Created At'];
      const csvRows = [
        headers.join(','),
        ...data.rows.map((u) =>
          [
            (u.name ?? '').replace(/"/g, '""'),
            u.email.replace(/"/g, '""'),
            u.roles.map((r) => r.name).join('; '),
            u.isActive ? 'Active' : 'Disabled',
            new Date(u.createdAt).toISOString(),
          ].join(',')
        ),
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export started', description: 'CSV download started.' });
    } catch {
      toast({ title: 'Export failed', description: 'Could not export users.', variant: 'destructive' });
    }
  }, [canExport, q, roleId, status, sort, order, total, toast]);

  const toggleStatus = useCallback(
    async (user: UserRow) => {
      if (!canDisable) return;
      try {
        const res = await fetch(`/api/users/${user.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !user.isActive }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
        toast({
          title: user.isActive ? 'User disabled' : 'User enabled',
          description: `${user.email} is now ${user.isActive ? 'disabled' : 'active'}.`,
        });
        fetchUsers();
        if (detailUserId === user.id) setDetailUserId(null);
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Failed to update status',
          variant: 'destructive',
        });
      }
    },
    [canDisable, toast, fetchUsers, detailUserId]
  );

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => row.original.name ?? '—',
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.original.email,
      },
      {
        id: 'roles',
        header: 'Role(s)',
        cell: ({ row }) =>
          row.original.roles.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.original.roles.map((r) => (
                <Badge key={r.id} variant="secondary" className="text-xs">
                  {r.name}
                </Badge>
              ))}
            </div>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'muted'}>
            {row.original.isActive ? 'Active' : 'Disabled'}
          </Badge>
        ),
      },
      {
        id: 'lastLogin',
        header: 'Last Login',
        cell: () => '—',
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' }),
      },
      ...(canRead || canUpdate || canDisable || canAssignRole
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }: { row: { original: UserRow } }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canRead && (
                      <DropdownMenuItem onClick={() => setDetailUserId(row.original.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                    )}
                    {canUpdate && (
                      <DropdownMenuItem onClick={() => setEditUser(row.original)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDisable && (
                      <DropdownMenuItem onClick={() => toggleStatus(row.original)}>
                        {row.original.isActive ? (
                          <>
                            <UserX className="mr-2 h-4 w-4" />
                            Disable
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Enable
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {canAssignRole && (
                      <DropdownMenuItem onClick={() => setDetailUserId(row.original.id)}>
                        <Shield className="mr-2 h-4 w-4" />
                        Assign Role
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } as ColumnDef<UserRow>,
          ]
        : []),
    ],
    [canRead, canUpdate, canDisable, canAssignRole, toggleStatus]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize) || 1,
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage users and roles</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UsersIcon className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">You do not have permission to view users.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage users and roles</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <AddUserDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              onSuccess={() => {
                setAddOpen(false);
                fetchUsers();
              }}
              roles={roles}
              canAssignRole={canAssignRole}
            >
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add / Invite User
            </Button>
          </AddUserDialog>
          )}
          {canManageRoles && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/roles">
                <Shield className="mr-2 h-4 w-4" />
                Manage Roles
              </Link>
            </Button>
          )}
          {canExport && (
            <Button variant="outline" onClick={handleExport} disabled={total === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User list</CardTitle>
          <CardDescription>Search, filter, and manage users. Actions depend on your permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search name or email..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <Select value={roleId || 'all'} onValueChange={(v) => { setRoleId(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear filters
            </Button>
          </div>

          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">Loading users...</div>
          ) : error ? (
            <div className="py-12 text-center text-destructive">{error}</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {editUser && (
        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
          onSuccess={() => {
            setEditUser(null);
            fetchUsers();
          }}
          canDisable={canDisable}
        />
      )}

      {detailUserId && (
        <UserDetailSheet
          userId={detailUserId}
          open={!!detailUserId}
          onOpenChange={(open) => !open && setDetailUserId(null)}
          onUpdate={() => fetchUsers()}
          permissions={{
            auditRead: permissions.includes('audit.read'),
            rolesAssign: canAssignRole,
            inventoryRead: permissions.includes('inventory:read') || permissions.includes('stock:read'),
          }}
        />
      )}
    </div>
  );
}
