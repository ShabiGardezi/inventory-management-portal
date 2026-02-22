'use client';

import { useState, useEffect } from 'react';
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
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';

interface MovementRow {
  id: string;
  movementType: string;
  quantity: number;
  referenceNumber: string | null;
  createdAt: string;
  productName: string;
  productSku: string;
  warehouseName: string;
  createdByEmail: string | null;
  value: number | null;
}

interface MovementsTableProps {
  title: string;
  type?: 'IN' | 'OUT' | 'ALL'; // OUT = sales, IN = purchases, ALL = all movements
}

const MOVEMENT_COLORS: Record<string, string> = {
  IN: 'hsl(142, 76%, 36%)',
  OUT: 'hsl(0, 84%, 60%)',
  TRANSFER: 'hsl(217, 91%, 60%)',
  ADJUSTMENT: 'hsl(38, 92%, 50%)',
};

export function MovementsTable({ title, type = 'ALL' }: MovementsTableProps) {
  const [data, setData] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (type === 'OUT') params.set('type', 'OUT');
      if (type === 'IN') params.set('type', 'IN');
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/stock/movements?${params}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have permission to view stock movements.');
        throw new Error('Failed to load data');
      }
      const json = await res.json();
      const rows = json.rows ?? json.movements ?? [];
      setData(
        rows.map((r: { id?: string; movementType: string; quantity: string | number; referenceNumber: string | null; createdAt: string; product?: { name: string; sku: string }; productName?: string; productSku?: string; warehouse?: { name: string }; warehouseName?: string; createdBy?: { email: string } | null; createdByEmail?: string | null }) => ({
          id: r.id ?? '',
          movementType: r.movementType,
          quantity: typeof r.quantity === 'string' ? Number(r.quantity) : r.quantity,
          referenceNumber: r.referenceNumber ?? null,
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : (r.createdAt as Date)?.toISOString?.() ?? '',
          productName: r.product?.name ?? r.productName ?? '',
          productSku: r.product?.sku ?? r.productSku ?? '',
          warehouseName: r.warehouse?.name ?? r.warehouseName ?? '',
          createdByEmail: r.createdBy?.email ?? r.createdByEmail ?? null,
          value: null as number | null,
        }))
      );
      const totalCount = json.total ?? json.pagination?.total ?? 0;
      const pageSizeVal = json.pageSize ?? json.pagination?.limit ?? 10;
      setTotal(totalCount);
      setTotalPages(json.pagination?.totalPages ?? (pageSizeVal ? Math.ceil(totalCount / pageSizeVal) : 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, limit, type, search, dateFrom, dateTo]);

  const typeCol: ColumnDef<MovementRow> = {
    accessorKey: 'movementType',
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string;
      return (
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${MOVEMENT_COLORS[v] ?? 'hsl(var(--muted))'}20`,
            color: MOVEMENT_COLORS[v] ?? 'inherit',
          }}
        >
          {v}
        </span>
      );
    },
  };

  const valueCol: ColumnDef<MovementRow> = {
    accessorKey: 'value',
    header: 'Value',
    cell: (info) => {
      const v = info.getValue() as number | null;
      return v != null ? formatCurrency(v) : '—';
    },
  };

  const columns: ColumnDef<MovementRow>[] = [
    { accessorKey: 'productName', header: 'Product' },
    { accessorKey: 'productSku', header: 'SKU', cell: (info) => <span className="font-mono text-muted-foreground">{String(info.getValue())}</span> },
    ...(type === 'ALL' ? [typeCol] : []),
    { accessorKey: 'quantity', header: 'Qty', cell: (info) => info.getValue() },
    valueCol,
    { accessorKey: 'warehouseName', header: 'Warehouse' },
    { accessorKey: 'referenceNumber', header: 'Reference', cell: (info) => info.getValue() ?? '—' },
    { accessorKey: 'createdAt', header: 'Date', cell: (info) => formatDate(String(info.getValue())) },
    { accessorKey: 'createdByEmail', header: 'By', cell: (info) => info.getValue() ?? '—' },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    state: {
      pagination: { pageIndex: page - 1, pageSize: limit },
    },
  });

  if (loading && data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search product..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Input
          type="date"
          placeholder="From"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="max-w-[140px]"
        />
        <Input
          type="date"
          placeholder="To"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="max-w-[140px]"
        />
        <div className="text-sm text-muted-foreground">
          {total} result{total !== 1 ? 's' : ''}
        </div>
      </div>

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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No movements found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages || 1}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
