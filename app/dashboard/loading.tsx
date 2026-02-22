import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-9 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-5 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      <DashboardSkeleton />
    </div>
  );
}
