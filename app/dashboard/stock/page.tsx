'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import Link from 'next/link';
import {
  Plus,
  Minus,
  ArrowRightLeft,
  Download,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MovementRow {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: string;
  quantity: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string; code: string | null };
  createdBy: { id: string; name: string | null; email: string } | null;
  batch?: { id: string; batchNumber: string; expiryDate?: string } | null;
  serialCount?: number | null;
  productSerials?: { serialNumber: string }[];
}

interface MovementsResponse {
  rows: MovementRow[];
  total: number;
  page: number;
  pageSize: number;
}

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'custom', label: 'Custom' },
] as const;

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'IN', label: 'IN' },
  { value: 'OUT', label: 'OUT' },
  { value: 'TRANSFER', label: 'TRANSFER' },
  { value: 'ADJUSTMENT', label: 'ADJUSTMENT' },
];

const REF_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'SALE', label: 'Sale' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'MANUAL', label: 'Manual' },
];

const ADJUST_REASONS = [
  { value: 'damage', label: 'Damage' },
  { value: 'recount', label: 'Recount' },
  { value: 'correction', label: 'Correction' },
  { value: 'opening_stock', label: 'Opening stock' },
];

function typeBadgeVariant(type: string): 'success' | 'destructive' | 'secondary' | 'outline' {
  switch (type) {
    case 'IN':
      return 'success';
    case 'OUT':
      return 'destructive';
    case 'TRANSFER':
      return 'secondary';
    case 'ADJUSTMENT':
      return 'outline';
    default:
      return 'secondary';
  }
}

function formatQty(type: string, qty: string): string {
  const n = Number(qty);
  if (type === 'OUT') return `-${n}`;
  return `+${n}`;
}

function StockMovementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { toast } = useToast();

  const permissions: string[] = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canRead = permissions.includes('stock:read') || permissions.includes('inventory:read');
  const canAdjust = permissions.includes('stock:adjust');
  const canTransfer = permissions.includes('stock:transfer');
  const canExport = permissions.includes('reports:read') || permissions.includes('inventory:read');
  const canWarehouseRead = permissions.includes('warehouse:read');
  const canReadApprovals = permissions.includes('approvals.read') || permissions.includes('approvals.review');

  const [rows, setRows] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)));
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState(searchParams.get('range') ?? '30d');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') ?? '');
  const [productIdFilter, setProductIdFilter] = useState(searchParams.get('productId') ?? '');
  const [type, setType] = useState(searchParams.get('type') ?? '');
  const [referenceType, setReferenceType] = useState(searchParams.get('referenceType') ?? '');
  const [mine, setMine] = useState(searchParams.get('mine') === 'true');

  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [drawerMovement, setDrawerMovement] = useState<MovementRow | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(null);

  const movementIdFromUrl = searchParams.get('movementId');

  const setUrlParams = useCallback(
    (updates: Record<string, string | number | boolean | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      (Object.entries(updates) as [string, string | number | boolean | undefined][]).forEach(
        ([k, v]) => {
          if (v === undefined || v === '' || v === false) p.delete(k);
          else p.set(k, String(v));
        }
      );
      router.replace(`/dashboard/stock?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const fetchMovements = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('range', range);
    if (range === 'custom' && from) params.set('from', from);
    if (range === 'custom' && to) params.set('to', to);
    if (q) params.set('q', q);
    if (warehouseId) params.set('warehouseId', warehouseId);
    if (productIdFilter) params.set('productId', productIdFilter);
    if (type) params.set('type', type);
    if (referenceType) params.set('referenceType', referenceType);
    if (mine) params.set('mine', 'true');
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sort', 'createdAt');
    params.set('order', 'desc');

    try {
      const res = await fetch(`/api/stock/movements?${params.toString()}`);
      if (res.status === 403) {
        setError('You do not have permission to view stock movements.');
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error('Failed to load movements');
      const data: MovementsResponse = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load movements');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canRead, range, from, to, q, warehouseId, productIdFilter, type, referenceType, mine, page, pageSize]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  useEffect(() => {
    if (canWarehouseRead) {
      fetch('/api/warehouses?limit=100')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.list && setWarehouses(d.list.map((w: { id: string; name: string; code: string | null }) => ({ id: w.id, name: w.name, code: w.code }))))
        .catch(() => {});
    }
  }, [canWarehouseRead]);

  useEffect(() => {
    if (!canReadApprovals) return;
    fetch('/api/approvals?status=PENDING&page=1&pageSize=1')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.pagination?.total != null) setPendingApprovalCount(d.pagination.total); })
      .catch(() => {});
  }, [canReadApprovals, adjustOpen, transferOpen]);

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    const params = new URLSearchParams();
    params.set('range', range);
    if (range === 'custom' && from) params.set('from', from);
    if (range === 'custom' && to) params.set('to', to);
    if (q) params.set('q', q);
    if (warehouseId) params.set('warehouseId', warehouseId);
    if (productIdFilter) params.set('productId', productIdFilter);
    if (type) params.set('type', type);
    if (referenceType) params.set('referenceType', referenceType);
    if (mine) params.set('mine', 'true');
    try {
      const res = await fetch(`/api/stock/movements/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export started', description: 'CSV download started.' });
    } catch {
      toast({ title: 'Export failed', description: 'Could not export movements.', variant: 'destructive' });
    }
  }, [canExport, range, from, to, q, warehouseId, productIdFilter, type, referenceType, mine, toast]);

  const clearFilters = useCallback(() => {
    setRange('30d');
    setFrom('');
    setTo('');
    setQ('');
    setWarehouseId('');
    setProductIdFilter('');
    setType('');
    setReferenceType('');
    setMine(false);
    setPage(1);
    setUrlParams({});
  }, [setUrlParams]);

  const openMovementDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/stock/movements/${id}`);
      if (!res.ok) return;
      const m = await res.json();
      setDrawerMovement(m);
    } catch {
      toast({ title: 'Error', description: 'Could not load movement details.', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    if (movementIdFromUrl && canRead) {
      openMovementDetail(movementIdFromUrl);
    }
  }, [movementIdFromUrl, canRead, openMovementDetail]);

  const columns = useMemo<ColumnDef<MovementRow>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Date / Time',
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return (
            <span className="whitespace-nowrap">
              {v ? new Date(v).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'movementType',
        header: 'Type',
        cell: ({ getValue }) => {
          const t = getValue() as string;
          return <Badge variant={typeBadgeVariant(t)}>{t}</Badge>;
        },
      },
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <Link
            href={`/dashboard/products/${row.original.productId}`}
            className="text-primary hover:underline font-medium"
          >
            {row.original.product.name} <span className="text-muted-foreground font-mono text-xs">({row.original.product.sku})</span>
          </Link>
        ),
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }) => (
          <Link
            href={`/dashboard/warehouses/${row.original.warehouseId}`}
            className="text-primary hover:underline"
          >
            {row.original.warehouse.name}
          </Link>
        ),
      },
      {
        id: 'qty',
        header: 'Qty',
        cell: ({ row }) => (
          <span className={row.original.movementType === 'OUT' ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
            {formatQty(row.original.movementType, row.original.quantity)}
          </span>
        ),
      },
      {
        id: 'batch',
        header: 'Batch',
        cell: ({ row }) => {
          const b = row.original.batch;
          return b ? <span className="font-mono text-xs">{b.batchNumber}</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: 'serialCount',
        header: 'Serials',
        cell: ({ row }) => {
          const n = row.original.serialCount;
          return n != null ? n : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: 'reference',
        header: 'Reference',
        cell: ({ row }) => {
          const ref = row.original.referenceNumber || row.original.referenceType || '—';
          const refType = row.original.referenceType;
          const refId = row.original.referenceId;
          if (refId && refType) {
            const href =
              refType === 'SALE' ? `/dashboard/sales/${refId}` :
              refType === 'PURCHASE' ? `/dashboard/purchases/${refId}` :
              refType === 'TRANSFER' ? `/dashboard/transfers/${refId}` : null;
            if (href) return <Link href={href} className="text-primary hover:underline">{ref}</Link>;
          }
          return <span>{ref}</span>;
        },
      },
      {
        id: 'performedBy',
        header: 'Performed By',
        cell: ({ row }) => row.original.createdBy?.email ?? '—',
      },
      {
        accessorKey: 'notes',
        header: 'Notes',
        cell: ({ getValue }) => {
          const n = getValue() as string | null;
          if (!n) return '—';
          const truncated = n.length > 40 ? `${n.slice(0, 40)}…` : n;
          return <span title={n}>{truncated}</span>;
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => openMovementDetail(row.original.id)}>
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [openMovementDetail]
  );

  const table = useReactTable({
    data: rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!canRead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Stock Movements</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">You do not have permission to view stock movements.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingApprovalCount != null && pendingApprovalCount > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <p className="text-sm font-medium">Awaiting approval: {pendingApprovalCount} request(s) pending review (adjustments / transfers).</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/approvals">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Review approvals
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground">View and filter stock movement history</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => {
              setRange(e.target.value as typeof range);
              setUrlParams({ range: e.target.value });
            }}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {range === 'custom' && (
            <>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </>
          )}
          {canAdjust && (
            <Button onClick={() => setAdjustOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adjust Stock
            </Button>
          )}
          {canTransfer && (
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer Stock
            </Button>
          )}
          {canExport && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow down movements by search, warehouse, type, and more</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search product name, SKU, barcode..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setUrlParams({ q: e.currentTarget.value || undefined, page: 1 })}
              className="max-w-xs"
            />
            {canWarehouseRead && (
              <select
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setUrlParams({ warehouseId: e.target.value || undefined, page: 1 });
                }}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[180px]"
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setUrlParams({ type: e.target.value || undefined, page: 1 });
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={referenceType}
              onChange={(e) => {
                setReferenceType(e.target.value);
                setUrlParams({ referenceType: e.target.value || undefined, page: 1 });
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {REF_TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => {
                  setMine(e.target.checked);
                  setUrlParams({ mine: e.target.checked || undefined, page: 1 });
                }}
              />
              Only my actions
            </label>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movements</CardTitle>
          <CardDescription>
            {total} movement(s) — page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (rows?.length ?? 0) === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : error ? (
            <p className="text-destructive py-8 text-center">{error}</p>
          ) : (rows?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No movements found for selected filters.</p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((hg) => (
                      <TableRow key={hg.id}>
                        {hg.headers.map((h) => (
                          <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => p - 1);
                      setUrlParams({ page: page - 1 });
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => {
                      setPage((p) => p + 1);
                      setUrlParams({ page: page + 1 });
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MovementDetailDrawer
        movement={drawerMovement}
        onClose={() => {
          setDrawerMovement(null);
          const p = new URLSearchParams(searchParams.toString());
          p.delete('movementId');
          const qs = p.toString();
          router.replace(qs ? `/dashboard/stock?${qs}` : '/dashboard/stock', { scroll: false });
        }}
      />

      <AdjustStockModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onSuccess={(opts) => {
          setAdjustOpen(false);
          fetchMovements();
          if (!opts?.pendingApproval) {
            toast({ title: 'Stock adjusted', description: 'The adjustment has been recorded.' });
          }
        }}
        warehouses={warehouses}
      />

      <TransferStockModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSuccess={(opts) => {
          setTransferOpen(false);
          fetchMovements();
          if (!opts?.pendingApproval) {
            toast({ title: 'Stock transferred', description: 'Transfer completed successfully.' });
          }
        }}
        warehouses={warehouses}
      />
    </div>
  );
}

export default function StockMovementsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Stock Movements</h1><p className="text-muted-foreground">View and filter stock movement history</p></div>
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    }>
      <StockMovementsContent />
    </Suspense>
  );
}

function MovementDetailDrawer({
  movement,
  onClose,
}: {
  movement: MovementRow | null;
  onClose: () => void;
}) {
  const open = !!movement;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Movement details</SheetTitle>
          <SheetDescription>View movement record (read-only)</SheetDescription>
        </SheetHeader>
        {movement && (
          <div className="mt-6 space-y-4 text-sm">
            <div><span className="font-medium text-muted-foreground">Date / Time</span><br />{new Date(movement.createdAt).toLocaleString()}</div>
            <div><span className="font-medium text-muted-foreground">Type</span><br /><Badge variant={typeBadgeVariant(movement.movementType)}>{movement.movementType}</Badge></div>
            <div><span className="font-medium text-muted-foreground">Product</span><br /><Link href={`/dashboard/products/${movement.productId}`} className="text-primary hover:underline">{movement.product.name} ({movement.product.sku})</Link></div>
            <div><span className="font-medium text-muted-foreground">Warehouse</span><br /><Link href={`/dashboard/warehouses/${movement.warehouseId}`} className="text-primary hover:underline">{movement.warehouse.name}</Link></div>
            <div><span className="font-medium text-muted-foreground">Quantity</span><br />{formatQty(movement.movementType, movement.quantity)}</div>
            {movement.batch && (
              <div>
                <span className="font-medium text-muted-foreground">Batch</span><br />
                <span className="font-mono">{movement.batch.batchNumber}</span>
                {movement.batch.expiryDate && <span className="text-muted-foreground ml-2">(exp: {movement.batch.expiryDate})</span>}
              </div>
            )}
            {movement.serialCount != null && movement.serialCount > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">Serials</span><br />
                {movement.productSerials && movement.productSerials.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    {movement.productSerials.slice(0, 10).map((s, i) => (
                      <span key={i} className="font-mono text-xs">{s.serialNumber}</span>
                    ))}
                    {movement.productSerials.length > 10 && (
                      <span className="text-muted-foreground text-xs">+{movement.productSerials.length - 10} more</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{movement.serialCount} serial(s)</span>
                )}
              </div>
            )}
            <div><span className="font-medium text-muted-foreground">Reference</span><br />{movement.referenceType ?? '—'} {movement.referenceNumber ?? ''} {movement.referenceId ?? ''}</div>
            <div><span className="font-medium text-muted-foreground">Performed by</span><br />{movement.createdBy?.email ?? '—'}</div>
            {movement.notes && <div><span className="font-medium text-muted-foreground">Notes</span><br />{movement.notes}</div>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AdjustStockModal({
  open,
  onClose,
  onSuccess,
  warehouses,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (opts?: { pendingApproval?: boolean }) => void;
  warehouses: { id: string; name: string; code: string | null }[];
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [method, setMethod] = useState<'increase' | 'decrease' | 'set'>('increase');
  const [quantity, setQuantity] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('correction');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const url = productSearch.length >= 2
        ? `/api/products?search=${encodeURIComponent(productSearch)}&limit=50`
        : `/api/products?limit=100`;
      fetch(url)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.products && setProductOptions(d.products.map((p: { id: string; name: string; sku: string }) => ({ id: p.id, name: p.name, sku: p.sku }))))
        .catch(() => setProductOptions([]));
    }, productSearch.length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, productSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !productId) {
      toast({ title: 'Required fields', description: 'Select warehouse and product.', variant: 'destructive' });
      return;
    }
    if (method !== 'set' && (!quantity || Number(quantity) <= 0)) {
      toast({ title: 'Invalid quantity', description: 'Enter a positive quantity.', variant: 'destructive' });
      return;
    }
    if (method === 'set' && (newQuantity === '' || Number(newQuantity) < 0)) {
      toast({ title: 'Invalid quantity', description: 'Enter a non-negative new quantity.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        productId,
        warehouseId,
        method,
        reason,
        notes: notes || undefined,
      };
      if (method === 'set') body.newQuantity = Number(newQuantity);
      else body.quantity = Number(quantity);
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Adjustment failed', description: data.error || res.statusText, variant: 'destructive' });
        return;
      }
      if (res.status === 202 && data.pendingApproval) {
        toast({ title: 'Sent for approval', description: data.message ?? 'Adjustment submitted for approval.' });
        onSuccess({ pendingApproval: true });
        return;
      }
      onSuccess();
    } catch {
      toast({ title: 'Error', description: 'Request failed.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>Record a stock adjustment (increase, decrease, or set to exact).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Warehouse</Label>
            <select
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Product (search by name or SKU)</Label>
            <Input
              placeholder="Type to search..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mt-1"
            />
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select product</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Adjustment method</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'increase' | 'decrease' | 'set')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="increase">Increase</option>
              <option value="decrease">Decrease</option>
              <option value="set">Set to exact</option>
            </select>
          </div>
          {method !== 'set' && (
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Amount"
                className="mt-1"
              />
            </div>
          )}
          {method === 'set' && (
            <div>
              <Label>New quantity</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Target quantity"
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label>Reason</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ADJUST_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferStockModal({
  open,
  onClose,
  onSuccess,
  warehouses,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (opts?: { pendingApproval?: boolean }) => void;
  warehouses: { id: string; name: string; code: string | null }[];
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const url = productSearch.length >= 2
        ? `/api/products?search=${encodeURIComponent(productSearch)}&limit=50`
        : `/api/products?limit=100`;
      fetch(url)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.products && setProductOptions(d.products.map((p: { id: string; name: string; sku: string }) => ({ id: p.id, name: p.name, sku: p.sku }))))
        .catch(() => setProductOptions([]));
    }, productSearch.length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, productSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !fromWarehouseId || !toWarehouseId) {
      toast({ title: 'Required fields', description: 'Select product and both warehouses.', variant: 'destructive' });
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      toast({ title: 'Invalid', description: 'Source and destination must be different.', variant: 'destructive' });
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast({ title: 'Invalid quantity', description: 'Enter a positive quantity.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity: Number(quantity),
          notes: notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Transfer failed', description: data.error || res.statusText, variant: 'destructive' });
        return;
      }
      if (res.status === 202 && data.pendingApproval) {
        toast({ title: 'Sent for approval', description: data.message ?? 'Transfer submitted for approval.' });
        onSuccess({ pendingApproval: true });
        return;
      }
      onSuccess();
    } catch {
      toast({ title: 'Error', description: 'Request failed.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
          <DialogDescription>Move stock from one warehouse to another.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Product (search by name or SKU)</Label>
            <Input
              placeholder="Type to search..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mt-1"
            />
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select product</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Source warehouse</Label>
            <select
              required
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Destination warehouse</Label>
            <select
              required
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0.01"
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Transferring…' : 'Transfer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
