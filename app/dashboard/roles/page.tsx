'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Shield,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/format';

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
  permissionsCount: number;
}

interface RolesResponse {
  rows: RoleRow[];
  total: number;
  page: number;
  pageSize: number;
}

export default function RolesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const permissions: string[] = (session?.user as { permissions?: string[] })?.permissions ?? [];

  const canRead = permissions.includes('roles.read') || permissions.includes('roles.manage');
  const canManage = permissions.includes('roles.manage');

  const [rows, setRows] = useState<RoleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'updatedAt'>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
        order,
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/roles?${params}`);
      const data: RolesResponse = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to fetch roles');
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canRead, page, pageSize, sort, order, search]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!canManage) return;
      setDeleting(true);
      try {
        const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to delete role');
        toast({ title: 'Role deleted', description: 'The role has been removed.' });
        setDeleteConfirmId(null);
        fetchRoles();
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Failed to delete role',
          variant: 'destructive',
        });
      } finally {
        setDeleting(false);
      }
    },
    [canManage, toast, fetchRoles]
  );

  const handleDuplicate = useCallback(
    async (role: RoleRow) => {
      if (!canManage) return;
      const name = `${role.name} (copy)`;
      try {
        const res = await fetch(`/api/roles/${role.id}/duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to duplicate role');
        toast({ title: 'Role duplicated', description: `Created "${name}".` });
        fetchRoles();
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Failed to duplicate role',
          variant: 'destructive',
        });
      }
    },
    [canManage, toast, fetchRoles]
  );

  const columns = useMemo<ColumnDef<RoleRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Role name',
        cell: ({ row }) => (
          <Link
            href={canRead ? `/dashboard/roles/${row.original.id}` : '#'}
            className={canRead ? 'font-medium text-primary hover:underline' : 'font-medium'}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) =>
          row.original.isSystem ? (
            <Badge variant="secondary">System</Badge>
          ) : (
            <Badge variant="outline">Custom</Badge>
          ),
      },
      {
        accessorKey: 'usersCount',
        header: 'Users',
        cell: ({ row }) => row.original.usersCount,
      },
      {
        accessorKey: 'permissionsCount',
        header: 'Permissions',
        cell: ({ row }) => row.original.permissionsCount,
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated at',
        cell: ({ row }) => formatDateTime(row.original.updatedAt),
      },
      ...(canManage
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }: { row: { original: RoleRow } }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/roles/${row.original.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        View / Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(row.original)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate role
                    </DropdownMenuItem>
                    {!row.original.isSystem && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteConfirmId(row.original.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete role
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } as ColumnDef<RoleRow>,
          ]
        : []),
    ],
    [canRead, canManage, handleDuplicate]
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
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">Manage roles and permissions</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">You do not have permission to view roles.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">Manage roles and permissions. Only custom roles can be deleted.</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/dashboard/roles/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Search and sort by name or updated date. Actions require roles.manage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <select
              value={`${sort}-${order}`}
              onChange={(e) => {
                const [s, o] = (e.target.value as string).split('-');
                setSort(s as 'name' | 'updatedAt');
                setOrder(o as 'asc' | 'desc');
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="updatedAt-desc">Updated (newest)</option>
              <option value="updatedAt-asc">Updated (oldest)</option>
            </select>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setPage(1); }}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">Loading roles...</div>
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
                          No roles found.
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

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Ensure no users are assigned to this role, or unassign them first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
