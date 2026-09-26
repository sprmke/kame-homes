import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Matches `AnalyticsKpiStrip`: 2×2 on phone, 4 across on lg. */
export function AnalyticsKpiStripSkeleton() {
  return (
    <section aria-hidden>
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - i * 0.05 }} />
        ))}
      </div>
    </section>
  );
}

/** Matches `AnalyticsSectionTabs` primary sliding tabs. */
export function AnalyticsSectionTabsSkeleton() {
  return (
    <div className="bg-muted inline-flex h-9 w-full max-w-full items-center gap-1 rounded-lg p-1 sm:w-auto">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-7 flex-1 rounded-md sm:min-w-[5.5rem] sm:flex-none" />
      ))}
    </div>
  );
}

/** Org portfolio comparison table (Property + metric columns). */
export function OrgPropertyComparisonTableSkeleton() {
  return (
    <section
      className="surface-card overflow-hidden"
      aria-busy="true"
      aria-label="Loading portfolio comparison"
    >
      <div className="border-separator flex items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="size-9 shrink-0 rounded-lg" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="border-separator bg-muted/30 flex gap-4 border-b px-4 py-2.5">
            {[120, 64, 48, 48, 72, 56].map((w, i) => (
              <Skeleton
                key={i}
                className={cn('h-2.5 shrink-0 rounded-full', i > 2 && 'hidden sm:block')}
                style={{ width: w }}
              />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-4 px-4 py-3',
                i > 0 && 'border-separator border-t'
              )}
              style={{ opacity: 1 - i * 0.08 }}
            >
              <Skeleton className="h-3.5 w-32 max-w-[40%] flex-1" />
              <Skeleton className="hidden h-3 w-12 sm:block" />
              <Skeleton className="hidden h-3 w-14 md:block" />
              <Skeleton className="hidden h-3 w-14 md:block" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OrgAnalyticsSkeleton() {
  return (
    <div
      className="flex flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading portfolio analytics"
    >
      <AnalyticsKpiStripSkeleton />
      <OrgPropertyComparisonTableSkeleton />
    </div>
  );
}

/** Default property analytics overview tab: KPIs + tabs + 2×2 chart cards. */
export function PropertyAnalyticsSkeleton() {
  return (
    <div
      className="flex flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading analytics"
    >
      <AnalyticsKpiStripSkeleton />
      <AnalyticsSectionTabsSkeleton />
      <div className="grid min-w-0 gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-card p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-[180px] w-full rounded-xl sm:h-[220px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
