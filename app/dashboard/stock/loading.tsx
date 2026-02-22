import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function StockLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-9 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-5 w-80 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 w-24 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="h-12 w-full animate-pulse rounded-t border-b bg-muted/50" />
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="h-14 w-full animate-pulse border-b bg-muted/30 last:rounded-b" />
            ))}
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-9 w-9 animate-pulse rounded bg-muted" />
              <div className="h-9 w-9 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
