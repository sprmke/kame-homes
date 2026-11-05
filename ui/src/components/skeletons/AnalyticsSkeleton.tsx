import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  CalendarCheck,
  DollarSign,
  Eye,
  Gauge,
  MapPin,
  Percent,
  PieChart,
  Users,
  UsersRound,
} from 'lucide-react';

import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { OrgListingViewMode } from '@/features/dashboard/org/lib/orgListingViewMode';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { StatCardSkeleton } from '@/components/shared/StatCard';
import { AdminListToolbarSkeleton } from '@/components/skeletons/AdminSkeletons';
import { OrgListingViewSkeleton } from '@/components/skeletons/OrgListingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

import type { LucideIcon } from 'lucide-react';

const ANALYTICS_KPI_METRICS: Array<{ title: string; icon: LucideIcon }> = [
  { title: 'Occupancy', icon: Percent },
  { title: 'Avg nightly rate', icon: BedDouble },
  { title: 'Revenue per night', icon: BarChart3 },
  { title: 'Bookings', icon: CalendarCheck },
];

const ANALYTICS_TABS = ['Overview', 'Trends', 'Guests', 'AI review'];

const PROPERTY_OVERVIEW_HEADERS: Array<{ title: string; icon: LucideIcon }> = [
  { title: 'Guest age', icon: Users },
  { title: 'Party size', icon: UsersRound },
  { title: 'Guest origins', icon: MapPin },
  { title: 'Where bookings come from', icon: PieChart },
  { title: 'Listing visits', icon: Eye },
  { title: 'How you compare', icon: Gauge },
];

/** Matches `AnalyticsKpiStrip`: 2×2 on phone, 4 across on lg. */
export function AnalyticsKpiStripSkeleton() {
  return (
    <section aria-hidden>
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {ANALYTICS_KPI_METRICS.map((metric, i) => (
          <AdminMetricCardSkeleton
            key={metric.title}
            title={metric.title}
            icon={metric.icon}
            showTrend
            changeLabel="vs last period"
            style={{ opacity: 1 - i * 0.05 }}
          />
        ))}
      </div>
    </section>
  );
}

/** Matches `AnalyticsSectionTabs` primary sliding tabs. */
export function AnalyticsSectionTabsSkeleton() {
  return (
    <div className="bg-muted inline-flex h-9 w-full max-w-full items-center gap-1 rounded-lg p-1 sm:w-auto">
      {ANALYTICS_TABS.map((label) => (
        <span
          key={label}
          className="text-muted-foreground inline-flex h-7 flex-1 items-center justify-center rounded-md px-2 text-[13px] font-medium sm:min-w-[5.5rem] sm:flex-none"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** Org analytics: `OrgAnalyticsKpiCards` (trend StatCards), then the listings section
 * (toolbar + listings in the default org listing view). */
export function OrgAnalyticsSkeleton({ view }: { view: OrgListingViewMode }) {
  return (
    <div
      role="status"
      className="flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading portfolio analytics"
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden>
        <StatCardSkeleton
          title="Revenue"
          icon={DollarSign}
          showTrend
          changeLabel="vs last period"
          style={{ opacity: 1 }}
        />
        <StatCardSkeleton
          title="Bookings"
          icon={CalendarCheck}
          showTrend
          changeLabel="vs last period"
          style={{ opacity: 0.95 }}
        />
        <StatCardSkeleton
          title="Occupancy"
          icon={Percent}
          showTrend
          changeLabel="vs last period"
          style={{ opacity: 0.9 }}
        />
        <StatCardSkeleton title="Needs attention" icon={AlertTriangle} style={{ opacity: 0.85 }} />
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 sm:gap-3">
        <AdminListToolbarSkeleton />
        <OrgListingViewSkeleton view={view} variant="analytics" label="Loading listings" />
      </div>
    </div>
  );
}

/** Default property analytics overview tab: KPIs + tabs + two rows of three chart cards. */
export function PropertyAnalyticsSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading analytics"
    >
      <AnalyticsKpiStripSkeleton />
      <AnalyticsSectionTabsSkeleton />
      {Array.from({ length: 2 }).map((_, row) => (
        <div key={row} className="grid min-w-0 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          {PROPERTY_OVERVIEW_HEADERS.slice(row * 3, row * 3 + 3).map((header) => (
            <div key={header.title} className="surface-card p-3 sm:p-4">
              <AdminSurfaceCardHeader
                icon={header.icon}
                title={header.title}
                iconClassName="bg-muted/80"
              />
              <Skeleton className="h-[180px] w-full rounded-xl sm:h-[220px]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
