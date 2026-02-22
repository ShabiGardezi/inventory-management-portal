import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MovementsTable } from '@/components/movements-table';

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales</h1>
        <p className="text-muted-foreground">
          Stock OUT movements (sales)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sales</CardTitle>
          <CardDescription>Paginated list with search and date range</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>}>
            <MovementsTable title="Sales" type="OUT" />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
