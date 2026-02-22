'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  flexRender,
  type RowSelectionState,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditProductDialog, type ProductForEdit } from '@/components/edit-product-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Trash2, BarChart3 } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  price: number | null;
  reorderLevel: number | null;
  isActive: boolean;
  trackBatches: boolean;
  trackSerials: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PERM_UPDATE = ['product:update', 'inventory.update'];
const PERM_DELETE = ['product:delete', 'inventory.delete'];

function hasAnyPermission(permissions: string[] | undefined, allowed: string[]): boolean {
  if (!permissions?.length) return false;
  return allowed.some((p) => permissions.includes(p));
}

interface ProductsTableProps {
  /** Increment to force a refetch (e.g. after bulk import) */
  refreshTrigger?: number;
}

export function ProductsTable({ refreshTrigger = 0 }: ProductsTableProps) {
  const searchParams = useSearchParams();
  const filterLowStock = searchParams.get('filter') === 'low-stock';
  const { data: session } = useSession();
  const { toast } = useToast();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canUpdate = hasAnyPermission(permissions, PERM_UPDATE);
  const canDelete = hasAnyPermission(permissions, PERM_DELETE);

  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showMetricsColumns, setShowMetricsColumns] = useState(false);
  const [metricsByProductId, setMetricsByProductId] = useState<
    Record<string, { minDaysOfCover: number; suggestedReorderQty: number }>
  >({});

  const fetchProducts = async (page: number, limit: number, searchTerm: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (filterLowStock) {
        params.set('filter', 'low-stock');
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to view products.');
        }
        throw new Error('Failed to fetch products');
      }

      const result: ProductsResponse = await response.json();
      setData(result.products);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(pagination.page, pagination.limit, search);
  }, [pagination.page, pagination.limit, search, filterLowStock, refreshTrigger]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filterLowStock]);

  useEffect(() => {
    if (!showMetricsColumns || data.length === 0) {
      if (!showMetricsColumns) setMetricsByProductId({});
      return;
    }
    const ids = data.map((p) => p.id);
    const qs = new URLSearchParams({ productIds: ids.join(',') });
    fetch(`/api/inventory-metrics/by-products?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load metrics'))))
      .then((body: { metrics?: Record<string, { minDaysOfCover: number; suggestedReorderQty: number }> }) => {
        setMetricsByProductId(body.metrics ?? {});
      })
      .catch(() => setMetricsByProductId({}));
  }, [showMetricsColumns, data]);

  const refreshProducts = useCallback(() => {
    fetchProducts(pagination.page, pagination.limit, search);
  }, [pagination.page, pagination.limit, search]);

  const handleSingleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          toast({ title: 'Cannot delete', description: json.error ?? 'Product has dependencies.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Error', description: json.error ?? 'Failed to delete product', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Product deleted (archived).' });
      setDeleteTarget(null);
      refreshProducts();
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id);
    if (selectedIds.length === 0) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          toast({ title: 'Cannot delete', description: json.error ?? 'Some products could not be deleted.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Error', description: json.error ?? 'Failed to delete products', variant: 'destructive' });
        return;
      }
      const count = json.deletedCount ?? selectedIds.length;
      toast({ title: 'Success', description: `${count} product(s) deleted (archived).` });
      setRowSelection({});
      setBulkDeleteOpen(false);
      refreshProducts();
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      ...(canDelete
        ? [
            {
              id: 'select',
              header: ({ table: t }: { table: { getIsAllPageRowsSelected: () => boolean; getIsSomePageRowsSelected: () => boolean; toggleAllPageRowsSelected: (value: boolean) => void } }) => (
                <Checkbox
                  checked={t.getIsAllPageRowsSelected() || (t.getIsSomePageRowsSelected() && 'indeterminate')}
                  onCheckedChange={(value) => t.toggleAllPageRowsSelected(!!value)}
                  aria-label="Select all"
                  className="translate-y-0.5"
                />
              ),
              cell: ({ row }: { row: { getIsSelected: () => boolean; toggleSelected: (value?: boolean) => void } }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  aria-label="Select row"
                  className="translate-y-0.5"
                  onClick={(e) => e.stopPropagation()}
                />
              ),
              enableSorting: false,
              enableHiding: false,
            } as ColumnDef<Product>,
          ]
        : []),
      {
        accessorKey: 'sku',
        header: 'SKU',
        cell: (info) => (
          <span className="font-mono font-medium">{info.getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: (info) => {
          const raw = info.getValue();
          const num = raw != null ? Number(raw) : NaN;
          return Number.isFinite(num) ? `$${num.toFixed(2)}` : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: 'reorderLevel',
        header: 'Reorder level',
        cell: (info) => {
          const v = info.getValue();
          return v != null ? Number(v) : <span className="text-muted-foreground">—</span>;
        },
      },
      ...(showMetricsColumns
        ? [
            {
              id: 'daysOfCover',
              header: 'Days of cover',
              cell: ({ row }: { row: { original: Product } }) => {
                const m = metricsByProductId[row.original.id];
                if (m == null) return <span className="text-muted-foreground">—</span>;
                const d = m.minDaysOfCover;
                const isCritical = d < 7;
                const isWarning = d < 14 && !isCritical;
                const className = isCritical
                  ? 'text-red-600 dark:text-red-400 font-medium'
                  : isWarning
                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : '';
                return <span className={className}>{Number.isFinite(d) ? d.toFixed(1) : '—'}</span>;
              },
            } as ColumnDef<Product>,
            {
              id: 'suggestedReorder',
              header: 'Suggested reorder',
              cell: ({ row }: { row: { original: Product } }) => {
                const m = metricsByProductId[row.original.id];
                if (m == null) return <span className="text-muted-foreground">—</span>;
                const q = m.suggestedReorderQty;
                const className = q > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : '';
                return <span className={className}>{Number.isFinite(q) ? Math.round(q) : '—'}</span>;
              },
            } as ColumnDef<Product>,
          ]
        : []),
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: (info) => {
          const isActive = info.getValue() as boolean;
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                isActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {isActive ? 'Active' : 'Inactive'}
            </span>
          );
        },
      },
      {
        id: 'tracking',
        header: 'Tracking',
        cell: ({ row }: { row: { original: Product } }) => {
          const p = row.original;
          const badges: string[] = [];
          if (p.trackBatches) badges.push('Batch');
          if (p.trackSerials) badges.push('Serial');
          if (badges.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          );
        },
      },
      ...(canUpdate || canDelete
        ? [
            {
              id: 'actions',
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }: { row: { original: Product } }) => {
                const product = row.original;
                return (
                  <div className="flex items-center gap-1">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit ${product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditProduct(product);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete ${product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: product.id, name: product.name });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              },
              enableSorting: false,
              enableHiding: false,
            } as ColumnDef<Product>,
          ]
        : []),
    ],
    [canUpdate, canDelete, showMetricsColumns, metricsByProductId]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: pagination.totalPages,
    getRowId: (row) => row.id,
    enableRowSelection: canDelete,
    state: {
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit,
      },
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
  });

  const selectedCount = table.getSelectedRowModel().rows.length;
  const showBulkDelete = canDelete && selectedCount > 0;

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="max-w-sm"
          />
          <Button
            variant={showMetricsColumns ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowMetricsColumns((v) => !v)}
            title="Toggle Days of cover and Suggested reorder columns"
          >
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Reorder metrics
          </Button>
          {showBulkDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              Bulk Delete ({selectedCount})
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {data.length} of {pagination.total} products
        </div>
      </div>

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
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EditProductDialog
        product={editProduct as ProductForEdit | null}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditProduct(null);
        }}
        onSuccess={() => {
          refreshProducts();
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This action cannot be undone.</p>
                <p className="text-muted-foreground">
                  Deleting will archive the product. History will remain.
                </p>
                {deleteTarget && (
                  <p className="font-medium">Product: {deleteTarget.name}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSingleDeleteConfirm();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete products?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>You are about to delete {selectedCount} product(s). This action cannot be undone.</p>
                <p className="text-muted-foreground">
                  Deleting will archive the products. Stock history will remain.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDeleteConfirm();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}
            disabled={pagination.page === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
            }
            disabled={pagination.page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.min(prev.totalPages, prev.page + 1),
              }))
            }
            disabled={pagination.page >= pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.totalPages }))
            }
            disabled={pagination.page >= pagination.totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
