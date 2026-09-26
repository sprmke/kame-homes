import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Developments / hosts / approvals list pages: summary + toolbar + table. */
export function SuperAdminAdminListBodySkeleton({
  metricCount = 4,
  tableRows = 6,
}: {
  metricCount?: number;
  tableRows?: number;
} = {}) {
  return (
    <div className="space-y-3 sm:space-y-4" aria-busy="true" aria-label="Loading">
      {metricCount > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: metricCount }).map((_, i) => (
            <AdminMetricCardSkeleton key={i} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full rounded-lg sm:max-w-xs" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </div>
      <div className="surface-card overflow-hidden">
        <div className="border-separator flex gap-4 border-b px-4 py-3">
          {[80, 120, 64, 48].map((w, i) => (
            <Skeleton key={i} className="h-2.5 rounded-full" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: tableRows }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-4 px-4 py-3.5',
              i > 0 && 'border-separator border-t'
            )}
          >
            <Skeleton className="h-3.5 max-w-[200px] flex-1" />
            <Skeleton className="hidden h-3 w-16 md:block" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="ml-auto size-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Overview / AI usage: KPI grid + chart cards. */
export function SuperAdminOverviewBodySkeleton({ metricCount = 9 }: { metricCount?: number } = {}) {
  return (
    <div className="space-y-3 sm:space-y-4" aria-busy="true" aria-label="Loading overview">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: metricCount }).map((_, i) => (
          <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - (i % 4) * 0.05 }} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="surface-card p-4">
            <Skeleton className="mb-3 h-4 w-32" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
        ))}
      </div>
      <ListRowsSkeleton rows={4} label="Loading activity" />
    </div>
  );
}

export function SuperAdminAuditBodySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading audit log">
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <ListRowsSkeleton rows={8} />
    </div>
  );
}
