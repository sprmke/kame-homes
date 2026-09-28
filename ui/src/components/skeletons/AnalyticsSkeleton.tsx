import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { OrgListingViewMode } from '@/features/dashboard/org/lib/orgListingViewMode';

import { StatCardSkeleton } from '@/components/shared/StatCard';
import { AdminListToolbarSkeleton } from '@/components/skeletons/AdminSkeletons';
import { OrgListingViewSkeleton } from '@/components/skeletons/OrgListingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

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

/** Org analytics: `OrgAnalyticsKpiCards` (trend StatCards), then the listings section
 * (toolbar + listings in the default org listing view). */
export function OrgAnalyticsSkeleton({ view }: { view: OrgListingViewMode }) {
  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading portfolio analytics"
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} showTrend style={{ opacity: 1 - i * 0.05 }} />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 sm:gap-3">
        <AdminListToolbarSkeleton />
        <OrgListingViewSkeleton view={view} variant="analytics" label="Loading listings" />
      </div>
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
