'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Warehouse,
  Package,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';

interface WarehouseRow {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  totalSkus: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  lastMovementDate: string | null;
}

interface AggregateStats {
  totalWarehouses: number;
  totalStockValue: number;
  totalLowStockItems: number;
  transfersThisWeek: number;
}

interface ListResponse {
  list: WarehouseRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function WarehouseRowActions({
  row,
  canUpdate,
  canDelete,
  onDeactivated,
}: {
  row: WarehouseRow;
  canUpdate: boolean;
  canDelete: boolean;
  onDeactivated: () => void;
}) {
  const [deactivating, setDeactivating] = useState(false);
  const handleDeactivate = async () => {
    if (!confirm(`Deactivate "${row.name}"?`)) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/warehouses/${row.id}/deactivate`, { method: 'PATCH' });
      if (res.ok) onDeactivated();
    } finally {
      setDeactivating(false);
    }
  };
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/warehouses/${row.id}`}>View</Link>
      </Button>
      {canUpdate && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/warehouses/${row.id}/edit`}>Edit</Link>
        </Button>
      )}
      {canDelete && row.isActive && (
        <Button variant="ghost" size="sm" onClick={handleDeactivate} disabled={deactivating}>
          {deactivating ? '…' : 'Deactivate'}
        </Button>
      )}
    </div>
  );
}

export default function WarehousesPage() {
  const { data: session } = useSession();
  const permissions: string[] = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canCreate = permissions.includes('warehouse:create');
  const canUpdate = permissions.includes('warehouse:update');
  const canDelete = permissions.includes('warehouse:delete');

  const [list, setList] = useState<WarehouseRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortDir,
      });
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (lowStockOnly) params.set('lowStockOnly', 'true');

      const res = await fetch(`/api/warehouses?${params}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have permission to view warehouses.');
        throw new Error('Failed to load warehouses');
      }
      const data: ListResponse = await res.json();
      setList(data.list);
      setPagination((prev) => ({ ...prev, ...data.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/warehouses/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      setStats(null);
    }
  };

  useEffect(() => {
    fetchList();
  }, [pagination.page, pagination.limit, sortBy, sortDir, statusFilter, lowStockOnly, search]);

  useEffect(() => {
    fetchStats();
  }, []);

  const columns = useMemo<ColumnDef<WarehouseRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Warehouse Name',
        cell: ({ row }) => (
          <Link
            href={`/dashboard/warehouses/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => (
          <Badge variant={getValue() ? 'success' : 'secondary'}>
            {getValue() ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        accessorKey: 'totalSkus',
        header: 'SKUs',
        cell: ({ getValue }) => Number(getValue()).toLocaleString(),
      },
      {
        accessorKey: 'totalQuantity',
        header: 'Total Qty',
        cell: ({ getValue }) => Number(getValue()).toLocaleString(),
      },
      {
        accessorKey: 'totalValue',
        header: 'Stock Value',
        cell: ({ getValue }) => formatCurrency(Number(getValue())),
      },
      {
        accessorKey: 'lowStockCount',
        header: 'Low Stock',
        cell: ({ getValue }) => {
          const n = Number(getValue());
          return n > 0 ? (
            <Badge variant="destructive">{n}</Badge>
          ) : (
            <span className="text-muted-foreground">0</span>
          );
        },
      },
      {
        accessorKey: 'lastMovementDate',
        header: 'Last Movement',
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <WarehouseRowActions
            row={row.original}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onDeactivated={fetchList}
          />
        ),
      },
    ],
    [canUpdate, canDelete]
  );

  const table = useReactTable({
    data: list,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: pagination.totalPages,
    state: { pagination: { pageIndex: pagination.page - 1, pageSize: pagination.limit } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Warehouses</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/warehouses/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Warehouse
            </Link>
          </Button>
        )}
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Warehouses</CardTitle>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.totalWarehouses != null ? (
                <span className="text-2xl font-bold">{stats.totalWarehouses}</span>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.totalStockValue != null ? (
                <span className="text-2xl font-bold">{formatCurrency(stats.totalStockValue)}</span>
              ) : (
                <Skeleton className="h-8 w-24" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.totalLowStockItems != null ? (
                <span className="text-2xl font-bold">{stats.totalLowStockItems}</span>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transfers This Week</CardTitle>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.transfersThisWeek != null ? (
                <span className="text-2xl font-bold">{stats.transfersThisWeek}</span>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Warehouse list</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="max-w-[200px]"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => {
                    setLowStockOnly(e.target.checked);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                />
                Low stock only
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-destructive">{error}</div>
          )}
          {loading && list.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((hg) => (
                      <TableRow key={hg.id}>
                        {hg.headers.map((h) => (
                          <TableHead key={h.id}>
                            {typeof h.column.columnDef.header === 'string'
                              ? h.column.columnDef.header
                              : flexRender(h.column.columnDef.header, h.getContext())}
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
                          No warehouses found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages || 1} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: 1 }))}
                    disabled={pagination.page === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: p.totalPages }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
