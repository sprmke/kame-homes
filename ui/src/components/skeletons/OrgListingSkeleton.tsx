import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { OrgListingViewMode } from '@/features/dashboard/org/lib/orgListingViewMode';

import {
  AdminListToolbarSkeleton,
  ListingCardGridSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Same as `orgListingGridClassName` / `orgListingStackClassName` in `OrgListingToolbar`. */
const GRID_CLASS = 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4';
const STACK_CLASS = 'space-y-4';

type OrgListingSkeletonVariant = 'inventory' | 'analytics';

/** `AdminDataTable` shape: name + subtitle, value columns, trailing action. Desktop only. */
function OrgListingTableSkeleton({
  columns,
  minWidth,
  label,
}: {
  columns: number[];
  minWidth: number;
  label: string;
}) {
  const gridTemplateColumns = `minmax(0,2fr) repeat(${columns.length}, minmax(0,1fr)) 3rem`;

  return (
    <div className="surface-card surface-card-clip" aria-busy="true" aria-label={label}>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <div
            className="border-separator bg-card grid items-center gap-4 border-b py-3 pl-5 pr-4"
            style={{ gridTemplateColumns }}
          >
            <Skeleton className="h-2.5 w-20 rounded-full" />
            {columns.map((width, i) => (
              <Skeleton key={i} className="h-2.5 rounded-full" style={{ width }} />
            ))}
            <span />
          </div>
          {Array.from({ length: 6 }).map((_, row) => (
            <div
              key={row}
              className={cn(
                'bg-card grid items-center gap-4 py-3.5 pl-5 pr-4',
                row > 0 && 'border-separator border-t'
              )}
              style={{ gridTemplateColumns, opacity: 1 - row * 0.08 }}
            >
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-40 max-w-full" />
                <Skeleton className="h-3 w-28 max-w-full" />
              </div>
              {columns.map((width, i) => (
                <Skeleton key={i} className="h-3.5" style={{ width: Math.max(width - 8, 24) }} />
              ))}
              <Skeleton className="ml-auto size-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** `OrgPropertyListRow` / `OrgParkingListRow`: photo left (top on phone), text, inline stats. */
function OrgInventoryListSkeleton({ label }: { label: string }) {
  return (
    <div className={STACK_CLASS} aria-busy="true" aria-label={label}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="border-border/50 bg-card shadow-card overflow-hidden rounded-xl border"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <div className="flex flex-col gap-4 p-4 sm:flex-row">
            <Skeleton className="h-40 w-full shrink-0 rounded-xl sm:h-44 sm:w-52" />
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3 max-w-xs lg:h-5" />
                    <Skeleton className="h-3.5 w-1/2 max-w-[14rem]" />
                    <Skeleton className="h-3 w-3/4 max-w-sm" />
                  </div>
                  <Skeleton className="size-8 shrink-0 rounded-md" />
                </div>
                <Skeleton className="h-3.5 w-full max-w-lg" />
              </div>
              <div className="flex flex-wrap gap-4">
                {Array.from({ length: 3 }).map((__, stat) => (
                  <Skeleton key={stat} className="h-4 w-24" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsMetricSkeleton() {
  return (
    <div className="min-w-0 space-y-1">
      <Skeleton className="h-2.5 w-12" />
      <Skeleton className="h-4 w-14 max-w-full" />
    </div>
  );
}

/** `OrgAnalyticsListingCard`: kind badge + name, attention, 3 metrics, outlook. */
function OrgAnalyticsGridSkeleton({ label }: { label: string }) {
  return (
    <div className={GRID_CLASS} aria-busy="true" aria-label={label}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="surface-card flex min-w-0 flex-col gap-3 p-3.5 sm:p-4"
          style={{ opacity: 1 - i * 0.05 }}
        >
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-3 w-1/2" />
          <div className="border-separator grid grid-cols-3 gap-2 border-t pt-3">
            {Array.from({ length: 3 }).map((__, m) => (
              <AnalyticsMetricSkeleton key={m} />
            ))}
          </div>
          <div className="border-separator space-y-1 border-t pt-3">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** `OrgAnalyticsListingRow`: name column, attention, 4 metrics (stacked on phone). */
function OrgAnalyticsListSkeleton({ label }: { label: string }) {
  return (
    <div className={STACK_CLASS} aria-busy="true" aria-label={label}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="surface-card flex min-w-0 flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <div className="min-w-0 space-y-1.5 sm:w-56 sm:shrink-0">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-3 w-2/3 sm:flex-1" />
          <div className="grid grid-cols-4 gap-3 sm:w-[26rem] sm:shrink-0">
            {Array.from({ length: 4 }).map((__, m) => (
              <AnalyticsMetricSkeleton key={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Body of an org listing section in the given view (see `defaultOrgListingViewMode`). */
export function OrgListingViewSkeleton({
  view,
  variant = 'inventory',
  label = 'Loading listings',
}: {
  view: OrgListingViewMode;
  variant?: OrgListingSkeletonVariant;
  label?: string;
}) {
  if (variant === 'analytics') {
    if (view === 'table') {
      return (
        <OrgListingTableSkeleton columns={[64, 96, 64, 80, 56, 72]} minWidth={960} label={label} />
      );
    }
    if (view === 'grid') return <OrgAnalyticsGridSkeleton label={label} />;
    return <OrgAnalyticsListSkeleton label={label} />;
  }

  if (view === 'table') {
    return <OrgListingTableSkeleton columns={[72, 64, 56, 80, 64]} minWidth={720} label={label} />;
  }
  if (view === 'grid') return <ListingCardGridSkeleton count={8} label={label} />;
  return <OrgInventoryListSkeleton label={label} />;
}

/** Org Properties / Parkings page body: summary KPIs, list toolbar, listings in `view`. */
export function OrgListingPageSkeleton({
  view,
  label,
}: {
  view: OrgListingViewMode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-3.5 lg:gap-4">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - i * 0.05 }} />
        ))}
      </div>
      <AdminListToolbarSkeleton />
      <OrgListingViewSkeleton view={view} label={label} />
    </div>
  );
}
