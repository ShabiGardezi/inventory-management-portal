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
import { formatDate } from '@/lib/format';

interface AuditRow {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
}

export function AuditTable() {
  const [data, setData] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource', resourceFilter);

      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have permission to view audit logs.');
        throw new Error('Failed to load audit logs');
      }
      const json = await res.json();
      setData(json.logs ?? []);
      setTotal(json.pagination?.total ?? 0);
      setTotalPages(json.pagination?.totalPages ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, limit, dateFrom, dateTo, actionFilter, resourceFilter]);

  const columns: ColumnDef<AuditRow>[] = [
    {
      accessorKey: 'action',
      header: 'Action',
      cell: (info) => (
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {String(info.getValue())}
        </span>
      ),
    },
    { accessorKey: 'resource', header: 'Resource' },
    { accessorKey: 'description', header: 'Description', cell: (info) => info.getValue() ?? '—' },
    { accessorKey: 'userEmail', header: 'User', cell: (info) => info.getValue() ?? '—' },
    { accessorKey: 'createdAt', header: 'Date', cell: (info) => formatDate(String(info.getValue())) },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    state: { pagination: { pageIndex: page - 1, pageSize: limit } },
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
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="max-w-[140px]" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="max-w-[140px]" />
        <Input placeholder="Action" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="max-w-[120px]" />
        <Input placeholder="Resource" value={resourceFilter} onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }} className="max-w-[120px]" />
        <div className="text-sm text-muted-foreground">{total} result{total !== 1 ? 's' : ''}</div>
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
                  No audit logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {page} of {totalPages || 1}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
