'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MovementsTable } from '@/components/movements-table';
import { ConfirmSaleModal } from '@/components/sales/confirm-sale-modal';
import { ShoppingCart, ClipboardCheck } from 'lucide-react';

function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return Boolean(permissions?.includes(permission));
}

export function SalesPageContent() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canConfirm = hasPermission(permissions, 'stock:adjust');
  const canReadApprovals = hasPermission(permissions, 'approvals.read') || hasPermission(permissions, 'approvals.review');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!canReadApprovals) return;
    fetch('/api/approvals?status=PENDING&type=SALE_CONFIRM&page=1&pageSize=1')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.pagination?.total != null) setPendingCount(d.pagination.total); })
      .catch(() => {});
  }, [canReadApprovals, refreshTrigger]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales</h1>
        <p className="text-muted-foreground">Stock OUT movements (sales)</p>
      </div>

      {pendingCount != null && pendingCount > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <p className="text-sm font-medium">Awaiting approval: {pendingCount} sale confirm request(s) pending review.</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/approvals">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Review approvals
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Recent sales</CardTitle>
            <CardDescription>Paginated list with search and date range</CardDescription>
          </div>
          {canConfirm && (
            <Button onClick={() => setConfirmOpen(true)}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Confirm sale
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <MovementsTable
            title="Sales"
            type="OUT"
            refreshTrigger={refreshTrigger}
          />
        </CardContent>
      </Card>

      <ConfirmSaleModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onSuccess={() => setRefreshTrigger((k) => k + 1)}
      />
    </div>
  );
}
