import { Car, DollarSign, FileText, Percent } from 'lucide-react';

import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { BookingsCalendarSkeleton, DashboardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function ParkingChartCardSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn('surface-card flex h-full min-w-0 flex-col p-3 sm:p-4', className)}
      aria-hidden
    >
      <div className="mb-2.5 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-4 w-24 lg:h-5" />
            <Skeleton className="hidden h-3 w-40 max-w-full lg:block" />
          </div>
        </div>
        <Skeleton className="hidden h-9 w-24 shrink-0 rounded-lg sm:block" />
      </div>
      <Skeleton className="h-[180px] w-full min-w-0 rounded-xl sm:h-[220px]" />
    </section>
  );
}

function ParkingDueCardSkeleton() {
  return (
    <section
      className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4"
      aria-hidden
    >
      <div className="mb-2.5 flex items-center justify-between gap-3 sm:mb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-4 w-28 lg:h-5" />
            <Skeleton className="hidden h-3 w-36 max-w-full lg:block" />
          </div>
        </div>
        <Skeleton className="h-9 w-14 shrink-0 rounded-lg" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-14 w-full rounded-xl"
            style={{ opacity: 1 - index * 0.08 }}
          />
        ))}
      </div>
    </section>
  );
}

/** Parking dashboard: attention strip, 4 KPIs, then cash flow / breakdown / calendar / due grid. */
export function ParkingDashboardSkeleton() {
  return (
    <div
      role="status"
      className="native-stagger flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading parking dashboard"
    >
      <Skeleton className="h-10 w-full rounded-xl" aria-hidden />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden>
        {[
          { title: 'Total Revenue', icon: DollarSign },
          { title: 'Total Reservations', icon: FileText },
          { title: 'Occupancy Rate', icon: Percent },
          { title: 'Average Nightly Rate', icon: Car },
        ].map((card, index) => (
          <AdminMetricCardSkeleton
            key={card.title}
            title={card.title}
            icon={card.icon}
            showTrend
            changeLabel="vs last period"
            style={{ opacity: 1 - index * 0.05 }}
          />
        ))}
      </div>

      <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-5 xl:gap-4" aria-hidden>
        <ParkingChartCardSkeleton className="lg:col-span-3 lg:col-start-1" />
        <ParkingChartCardSkeleton className="lg:col-span-2 lg:col-start-4" />
        <ParkingDueCardSkeleton />
        <section className="surface-card flex min-w-0 flex-col overflow-hidden p-3 sm:p-4 lg:col-span-3 lg:col-start-1 lg:row-start-2">
          <div className="mb-2.5 flex items-center justify-between gap-3 sm:mb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-4 w-24 lg:h-5" />
                <Skeleton className="hidden h-3 w-52 max-w-full lg:block" />
              </div>
            </div>
            <Skeleton className="hidden h-9 w-[7.25rem] shrink-0 rounded-lg sm:block" />
          </div>
          <BookingsCalendarSkeleton gridOnly compact />
        </section>
      </div>
    </div>
  );
}

/** Reuse property dashboard board where layout matches. */
export function ParkingDashboardRouteSkeleton() {
  return <DashboardSkeleton />;
}

export function ParkingBookingDetailSkeleton() {
  return (
    <div role="status" className="space-y-4" aria-busy="true" aria-label="Loading parking booking">
      <div className="flex flex-wrap gap-2 lg:hidden">
        <Skeleton className="h-11 w-28 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>
      <div className="surface-card space-y-5 p-4 sm:p-4 md:p-5">
        <Skeleton className="h-5 w-20 rounded-md" />
        <div className="border-border/80 bg-muted/30 flex gap-3 rounded-xl border p-4 sm:p-5">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border-border/60 bg-muted/20 flex gap-3 rounded-xl border p-3.5"
            >
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-3.5 w-24 max-w-full" />
              </div>
            </div>
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
