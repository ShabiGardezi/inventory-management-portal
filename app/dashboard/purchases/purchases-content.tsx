'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MovementsTable } from '@/components/movements-table';
import { ReceiveStockModal } from '@/components/purchases/receive-stock-modal';
import { PackageCheck, ClipboardCheck } from 'lucide-react';

function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return Boolean(permissions?.includes(permission));
}

export function PurchasesPageContent() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canReceive = hasPermission(permissions, 'stock:adjust');
  const canReadApprovals = hasPermission(permissions, 'approvals.read') || hasPermission(permissions, 'approvals.review');

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!canReadApprovals) return;
    fetch('/api/approvals?status=PENDING&type=PURCHASE_RECEIVE&page=1&pageSize=1')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.pagination?.total != null) setPendingCount(d.pagination.total); })
      .catch(() => {});
  }, [canReadApprovals, refreshTrigger]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Purchases</h1>
        <p className="text-muted-foreground">Stock IN movements (purchases)</p>
      </div>

      {pendingCount != null && pendingCount > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <p className="text-sm font-medium">Awaiting approval: {pendingCount} purchase receive request(s) pending review.</p>
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
            <CardTitle>Recent purchases</CardTitle>
            <CardDescription>Paginated list with search and date range</CardDescription>
          </div>
          {canReceive && (
            <Button onClick={() => setReceiveOpen(true)}>
              <PackageCheck className="mr-2 h-4 w-4" />
              Receive stock
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <MovementsTable
            title="Purchases"
            type="IN"
            refreshTrigger={refreshTrigger}
          />
        </CardContent>
      </Card>

      <ReceiveStockModal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onSuccess={() => {
          setReceiveOpen(false);
          setRefreshTrigger((k) => k + 1);
        }}
      />
    </div>
  );
}
