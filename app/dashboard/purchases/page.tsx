import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MovementsTable } from '@/components/movements-table';

export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Purchases</h1>
        <p className="text-muted-foreground">
          Stock IN movements (purchases)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent purchases</CardTitle>
          <CardDescription>Paginated list with search and date range</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>}>
            <MovementsTable title="Purchases" type="IN" />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
