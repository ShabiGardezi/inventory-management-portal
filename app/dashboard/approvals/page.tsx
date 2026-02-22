'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  ClipboardCheck,
} from 'lucide-react';

type ApprovalEntityType = 'PURCHASE_RECEIVE' | 'SALE_CONFIRM' | 'STOCK_ADJUSTMENT' | 'STOCK_TRANSFER';
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface ApprovalRow {
  id: string;
  entityType: ApprovalEntityType;
  entityId: string;
  status: ApprovalStatus;
  requestedAt: string;
  reviewedAt: string | null;
  requestComment: string | null;
  reviewComment: string | null;
  metadata: Record<string, unknown> | null;
  requestedBy: { id: string; email: string | null; name: string | null };
  reviewedBy: { id: string; email: string | null; name: string | null } | null;
}

interface ApprovalDetail extends ApprovalRow {
  entitySummary: Record<string, unknown> | null;
}

interface ListResponse {
  list: ApprovalRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const ENTITY_TYPE_LABELS: Record<ApprovalEntityType, string> = {
  PURCHASE_RECEIVE: 'Purchase receive',
  SALE_CONFIRM: 'Sale confirm',
  STOCK_ADJUSTMENT: 'Stock adjustment',
  STOCK_TRANSFER: 'Stock transfer',
};

const STATUS_VARIANTS: Record<ApprovalStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'default',
  APPROVED: 'secondary',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
};

function entityDisplayName(entityType: ApprovalEntityType, entityId: string, metadata: Record<string, unknown> | null): string {
  const ref = metadata && typeof metadata.referenceNumber === 'string' ? metadata.referenceNumber : null;
  if (ref) return ref;
  const shortId = entityId.length > 8 ? `${entityId.slice(0, 8)}…` : entityId;
  switch (entityType) {
    case 'PURCHASE_RECEIVE': return `Receive #${shortId}`;
    case 'SALE_CONFIRM': return `Sale #${shortId}`;
    case 'STOCK_ADJUSTMENT': return `Adjust #${shortId}`;
    case 'STOCK_TRANSFER': return `Transfer #${shortId}`;
    default: return shortId;
  }
}

function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return Boolean(permissions?.includes(permission));
}

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canReview = hasPermission(permissions, 'approvals.review');

  const [list, setList] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/approvals?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      const data: ListResponse = await res.json();
      setList(data.list ?? []);
      setPagination((prev) => ({
        ...prev,
        page: data.pagination?.page ?? prev.page,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, statusFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/approvals/${id}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setDetail(data);
    } catch {
      toast({ title: 'Error', description: 'Could not load approval details.', variant: 'destructive' });
      setDetail(null);
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (detailId) fetchDetail(detailId);
    else setDetail(null);
  }, [detailId, fetchDetail]);

  const handleRowClick = (id: string) => setDetailId(id);
  const handleApprove = async () => {
    if (!detailId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/approvals/${detailId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: actionComment || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Approve failed', description: data.error ?? res.statusText, variant: 'destructive' });
        return;
      }
      toast({
        title: data.executed ? 'Approved and executed' : 'Already approved',
        description: data.message ?? 'Request approved.',
      });
      setApproveOpen(false);
      setActionComment('');
      setDetailId(null);
      fetchList();
    } catch {
      toast({ title: 'Error', description: 'Request failed.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };
  const handleReject = async () => {
    if (!detailId) return;
    if (!actionComment.trim()) {
      toast({ title: 'Comment required', description: 'Please enter a reason for rejection.', variant: 'destructive' });
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/approvals/${detailId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: actionComment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Reject failed', description: data.error ?? res.statusText, variant: 'destructive' });
        return;
      }
      toast({ title: 'Request rejected', description: 'The request has been rejected.' });
      setRejectOpen(false);
      setActionComment('');
      setDetailId(null);
      fetchList();
    } catch {
      toast({ title: 'Error', description: 'Request failed.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<ApprovalRow>[]>(
    () => [
      {
        accessorKey: 'entityType',
        header: 'Type',
        cell: ({ getValue }) => {
          const v = getValue() as ApprovalEntityType;
          return <Badge variant="outline">{ENTITY_TYPE_LABELS[v] ?? v}</Badge>;
        },
      },
      {
        id: 'entity',
        header: 'Entity',
        cell: ({ row }) =>
          entityDisplayName(row.original.entityType, row.original.entityId, row.original.metadata),
      },
      {
        id: 'requestedBy',
        header: 'Requested by',
        cell: ({ row }) =>
          row.original.requestedBy?.name || row.original.requestedBy?.email || '—',
      },
      {
        accessorKey: 'requestedAt',
        header: 'Requested at',
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return v ? new Date(v).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const v = getValue() as ApprovalStatus;
          return <Badge variant={STATUS_VARIANTS[v]}>{v}</Badge>;
        },
      },
      ...(canReview
        ? [
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }: { row: { original: ApprovalRow } }) => (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRowClick(row.original.id)}
                    aria-label="View"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {row.original.status === 'PENDING' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDetailId(row.original.id);
                          setActionComment('');
                          setApproveOpen(true);
                        }}
                        aria-label="Approve"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDetailId(row.original.id);
                          setActionComment('');
                          setRejectOpen(true);
                        }}
                        aria-label="Reject"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            } as ColumnDef<ApprovalRow>,
          ]
        : []),
    ],
    [canReview]
  );

  const table = useReactTable({
    data: list,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-8 w-8" />
          Approvals
        </h1>
        <p className="text-muted-foreground">Review and approve pending requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Status, type, and date range</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs">Status</Label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[120px]"
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[160px]"
            >
              <option value="">All</option>
              {(Object.entries(ENTITY_TYPE_LABELS) as [ApprovalEntityType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">From date</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="mt-1 h-9 w-[140px]"
            />
          </div>
          <div>
            <Label className="text-xs">To date</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="mt-1 h-9 w-[140px]"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => { setStatusFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); setPagination((p) => ({ ...p, page: 1 })); }}>
            Clear
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>
            {pagination.total} request(s) — page {pagination.page} of {Math.max(1, pagination.totalPages)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && list.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : error ? (
            <p className="text-destructive py-8 text-center">{error}</p>
          ) : list.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No approval requests match the filters.</p>
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
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(row.original.id)}
                      >
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
                  Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <Sheet open={!!detailId && !approveOpen && !rejectOpen} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Approval request</SheetTitle>
            <SheetDescription>Request details and linked entity</SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <div className="mt-6 space-y-2">
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Type</span>
                <br />
                <Badge variant="outline">{ENTITY_TYPE_LABELS[detail.entityType]}</Badge>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Entity</span>
                <br />
                {entityDisplayName(detail.entityType, detail.entityId, detail.metadata)}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Status</span>
                <br />
                <Badge variant={STATUS_VARIANTS[detail.status]}>{detail.status}</Badge>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Requested by</span>
                <br />
                {detail.requestedBy?.name || detail.requestedBy?.email || '—'} at{' '}
                {new Date(detail.requestedAt).toLocaleString()}
              </div>
              {detail.requestComment && (
                <div>
                  <span className="font-medium text-muted-foreground">Request comment</span>
                  <br />
                  <p className="mt-1 rounded bg-muted/50 p-2">{detail.requestComment}</p>
                </div>
              )}
              {detail.metadata && Object.keys(detail.metadata).length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground">Summary</span>
                  <ul className="mt-1 list-disc list-inside text-muted-foreground">
                    {Object.entries(detail.metadata).map(([k, v]) => (
                      <li key={k}>{k}: {String(v)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.entitySummary && (
                <div>
                  <span className="font-medium text-muted-foreground">Entity details</span>
                  <pre className="mt-1 rounded bg-muted/50 p-2 text-xs overflow-x-auto">
                    {JSON.stringify(detail.entitySummary, null, 2)}
                  </pre>
                </div>
              )}
              {detail.status === 'PENDING' && canReview && (
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      setApproveOpen(true);
                      setActionComment('');
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRejectOpen(true);
                      setActionComment('');
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve request</DialogTitle>
            <DialogDescription>Optionally add a comment. The action will be executed once after approval.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Comment (optional)</Label>
            <Input
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder="Comment..."
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={actionLoading}>{actionLoading ? 'Approving…' : 'Approve'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>Please provide a reason for rejection (required).</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Comment (required)</Label>
            <Input
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder="Reason for rejection..."
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading || !actionComment.trim()}>
              {actionLoading ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
