import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ProductsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-5 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="h-10 flex-1 max-w-sm animate-pulse rounded bg-muted" />
            <div className="h-10 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
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
