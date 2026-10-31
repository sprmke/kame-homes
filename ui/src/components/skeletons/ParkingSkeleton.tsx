import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { DashboardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Parking dashboard: attention strip + 4 KPIs + calendar block. */
export function ParkingDashboardSkeleton() {
  return (
    <div
      className="native-stagger flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading parking dashboard"
    >
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - i * 0.05 }} />
        ))}
      </div>
      <section className="surface-card p-3 sm:p-4">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-[220px] w-full rounded-xl" />
      </section>
    </div>
  );
}

/** Reuse property dashboard board where layout matches. */
export function ParkingDashboardRouteSkeleton() {
  return <DashboardSkeleton />;
}

export function ParkingBookingDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading parking booking">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="surface-card space-y-4 p-4 sm:p-5">
        <Skeleton className="h-5 w-20 rounded-md" />
        <div className="border-border/80 bg-muted/30 flex gap-3 rounded-xl border p-4">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-11 flex-1 rounded-lg sm:w-32 sm:flex-none" />
          <Skeleton className="h-11 flex-1 rounded-lg sm:w-32 sm:flex-none" />
        </div>
      </div>
    </div>
  );
}
