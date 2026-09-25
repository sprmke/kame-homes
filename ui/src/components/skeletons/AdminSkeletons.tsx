import type { CSSProperties } from 'react';

import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { AppLoader } from '@/components/branding/AppLoader';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function AdminPageHeaderSkeleton({
  compact = false,
  card,
}: {
  compact?: boolean;
  /** Wrap in surface card. Defaults to true for `compact`. */
  card?: boolean;
}) {
  const useCard = card ?? compact;

  const content = (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        compact && 'sm:items-center'
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-center">
          <Skeleton className="h-6 w-32 sm:h-7 sm:w-36" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
    </div>
  );

  if (!useCard) {
    return content;
  }

  return <section className="mb-3 w-full">{content}</section>;
}

/** Matches AdminSectionNavLayout's shape: desktop sidebar nav (Card + section list) beside
 * Card-per-section main content; sidebar hidden below `lg` like the real layout. */
export function AppSettingsNavLayoutSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-8 xl:gap-10"
      aria-busy="true"
      aria-label="Loading settings"
    >
      <div className="hidden w-56 shrink-0 lg:block">
        <div className="border-border/50 bg-card space-y-1 rounded-xl border p-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="h-3 max-w-[7rem] flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full min-w-0 max-w-4xl flex-1 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border-border/50 bg-card rounded-xl border p-6"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <div className="mb-6 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 shrink-0 rounded" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-3.5 w-full max-w-sm" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-page variant of {@link AppSettingsNavLayoutSkeleton} — adds a fake page header for
 * callers that return the skeleton before rendering their own AdminMobilePage/title (e.g.
 * PropertySettingsCard, ParkingSettingsCard, DevelopmentSettingsCard). Callers whose real title
 * is already on screen while only the section content loads (e.g. OrgSettingsPage) should use
 * {@link AppSettingsNavLayoutSkeleton} directly instead, to avoid a duplicate header. */
export function AppSettingsCardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      <AdminPageHeaderSkeleton compact />
      <AppSettingsNavLayoutSkeleton />
    </div>
  );
}

function DetailCardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-card shadow-card overflow-hidden rounded-xl border">
      <div className="border-border/70 bg-muted/25 flex items-center gap-2.5 border-b px-4 py-3.5 sm:px-5">
        <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg sm:!size-9" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-border/60 divide-y px-4 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookingDetailPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading booking">
      <Skeleton className="h-3 w-28" />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5 lg:gap-6">
        <div className="border-border/80 bg-card min-w-0 flex-1 overflow-hidden rounded-2xl border">
          <div className="border-border/70 bg-muted/25 border-b px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-6 w-40 max-w-full" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
                <Skeleton className="h-3 w-52 max-w-full" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-11 w-32 rounded-lg lg:h-9" />
                <Skeleton className="size-11 shrink-0 rounded-lg lg:size-9" />
              </div>
            </div>
          </div>
          <div className="min-w-0 space-y-4 px-3 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-lg" />
              ))}
            </div>
            <DetailCardSkeleton lines={4} />
            <DetailCardSkeleton lines={2} />
            <DetailCardSkeleton lines={5} />
            <DetailCardSkeleton lines={4} />
          </div>
        </div>
        <div className="w-full space-y-3 md:w-[min(100%,20rem)] md:shrink-0 lg:sticky lg:top-5 lg:w-[min(100%,24rem)] lg:self-start xl:w-[27rem]">
          <div className="border-border/50 bg-card rounded-xl border p-4">
            <Skeleton className="mb-4 h-4 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <Skeleton className="h-3 flex-1" style={{ maxWidth: `${100 - i * 8}%` }} />
                </div>
              ))}
            </div>
            <Skeleton className="mt-4 h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ParkingDetailFieldSkeleton() {
  return (
    <div className="border-border/60 bg-muted/20 flex gap-3 rounded-xl border p-3.5">
      <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-3.5 w-24 max-w-full" />
      </div>
    </div>
  );
}

export function ParkingBookingDetailPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading parking booking">
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
          {Array.from({ length: 4 }).map((_, i) => (
            <ParkingDetailFieldSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BookingsTableSkeleton() {
  return (
    <div
      className="surface-card surface-card-clip overflow-hidden"
      aria-busy="true"
      aria-label="Loading bookings"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="border-separator bg-card flex items-center gap-4 border-b px-4 py-3 sm:px-5">
            {[56, 96, 88, 32, 40, 56, 24].map((w, i) => (
              <Skeleton
                key={i}
                className={cn(
                  'h-2.5 shrink-0 rounded-full',
                  i === 3 && 'hidden md:block',
                  i === 4 && 'hidden sm:block',
                  i === 5 && 'hidden lg:block'
                )}
                style={{ width: w }}
              />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-card flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5',
                i > 0 && 'border-separator border-t'
              )}
              style={{ opacity: 1 - i * 0.08 }}
            >
              <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32 max-w-full" />
                  <Skeleton className="h-2.5 w-40 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-3 w-24 shrink-0" />
              <Skeleton className="hidden h-3 w-8 shrink-0 md:block" />
              <div className="hidden shrink-0 gap-1.5 sm:flex">
                <Skeleton className="size-7 rounded-md" />
              </div>
              <Skeleton className="hidden h-3 w-14 shrink-0 lg:block" />
              <Skeleton className="ml-auto size-9 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BookingsCardGridSkeleton() {
  return (
    <div
      className="native-stagger grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading bookings"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="surface-card overflow-hidden" style={{ opacity: 1 - i * 0.06 }}>
          {/* Phone list skeleton */}
          <div className="flex items-start gap-3.5 p-4 sm:hidden">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          {/* sm+ card skeleton */}
          <div className="hidden sm:block">
            <div className="space-y-4 p-4 pb-3">
              <Skeleton className="h-5 w-20 rounded-md" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </div>
            <div className="space-y-2 px-4 pb-3">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="border-separator bg-muted/20 dark:bg-muted/30 flex items-center justify-between gap-2 border-t px-4 py-3">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FinanceKpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        'grid gap-2 sm:gap-3 lg:gap-4',
        count === 3 && 'grid-cols-2 sm:grid-cols-3',
        count === 4 && 'grid-cols-2 lg:grid-cols-4',
        count === 2 && 'grid-cols-2'
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - i * 0.05 } as CSSProperties} />
      ))}
    </div>
  );
}

export function FinanceOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading finance overview">
      <FinanceKpiGridSkeleton count={4} />
    </div>
  );
}

export function MaintenanceOverviewSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
      aria-busy="true"
      aria-label="Loading maintenance overview"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - i * 0.05 } as CSSProperties} />
      ))}
    </div>
  );
}

export function PlansPageSkeleton() {
  return (
    <div
      className="space-y-5 sm:space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading plans"
    >
      <div className="border-border/50 bg-card rounded-2xl border p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-48" />
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-4 lg:gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Plan tier rail — title + prev/next arrows, 1/2/3 cards visible by breakpoint (no dots). */}
      <div className="min-w-0">
        <div className="mb-3 flex min-h-9 items-center justify-between gap-3 sm:mb-4">
          <Skeleton className="h-5 w-36" />
          <div className="flex shrink-0 items-center gap-1.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="size-9 shrink-0 rounded-full" />
          </div>
        </div>
        <div className="flex items-stretch gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'border-border/70 bg-card min-w-0 flex-1 space-y-4 rounded-2xl border p-4 sm:p-5',
                i === 1 && 'hidden md:block',
                i === 2 && 'hidden lg:block'
              )}
              style={{ opacity: 1 - i * 0.08 }}
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-8 w-28" />
              <div className="space-y-3 pt-1">
                {Array.from({ length: 6 }).map((__, row) => (
                  <Skeleton
                    key={row}
                    className="h-3.5 w-full"
                    style={{ opacity: 1 - row * 0.08 }}
                  />
                ))}
              </div>
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* FAQ section — icon + title header, bordered accordion rows. */}
      <div className="border-border/50 bg-card rounded-2xl border p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 shrink-0 rounded" />
          <Skeleton className="h-5 w-56 max-w-full" />
        </div>
        <div className="mt-4 space-y-3 sm:mt-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="min-h-11 w-full rounded-lg"
              style={{ opacity: 1 - i * 0.08 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FinanceStaysCardGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading stays"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="border-border/50 bg-card flex min-h-[11.5rem] flex-col overflow-hidden rounded-xl border"
          style={{ opacity: 1 - i * 0.06 }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-3.5 pt-3.5 sm:px-4 sm:pt-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-auto h-3 w-2/3" />
          </div>
          <div className="border-separator bg-muted/20 dark:bg-muted/30 mt-3 flex items-center justify-between gap-2 border-t px-3.5 py-2.5 sm:px-4">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-1">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Finance ledger table (Date+icon | Description | Category(md) | Status | Amount | Actions). */
export function FinanceStaysTableSkeleton() {
  return (
    <div
      className="surface-card surface-card-clip overflow-hidden"
      aria-busy="true"
      aria-label="Loading transactions"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="border-separator bg-card flex items-center gap-4 border-b px-4 py-3 sm:px-5">
            {[64, 120, 64, 48, 40, 24].map((w, i) => (
              <Skeleton
                key={i}
                className={cn('h-2.5 shrink-0 rounded-full', i === 2 && 'hidden md:block')}
                style={{ width: w }}
              />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-card flex items-center gap-3 px-4 py-4 sm:px-5',
                i > 0 && 'border-separator border-t'
              )}
              style={{ opacity: 1 - i * 0.08 }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32 max-w-full" />
                  <Skeleton className="h-2.5 w-24 max-w-full" />
                </div>
              </div>
              <Skeleton className="hidden h-3 w-16 shrink-0 md:block" />
              <Skeleton className="h-4 w-16 shrink-0 rounded-md" />
              <Skeleton className="h-3 w-14 shrink-0" />
              <Skeleton className="size-8 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Maintenance reminders table (Date | Label | Category(md) | Status(md) | Notes(sm) | Actions). */
export function FinanceOperatingTabSkeleton() {
  return (
    <div
      className="surface-card surface-card-clip overflow-hidden"
      aria-busy="true"
      aria-label="Loading reminders"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="border-separator bg-card flex items-center gap-4 border-b px-4 py-3 sm:px-5">
            {[40, 120, 64, 56, 88, 24].map((w, i) => (
              <Skeleton
                key={i}
                className={cn(
                  'h-2.5 shrink-0 rounded-full',
                  (i === 2 || i === 3) && 'hidden md:block',
                  i === 4 && 'hidden sm:block'
                )}
                style={{ width: w }}
              />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-card flex items-center gap-4 px-4 py-3.5 sm:px-5',
                i > 0 && 'border-separator border-t'
              )}
              style={{ opacity: 1 - i * 0.08 }}
            >
              <Skeleton className="h-3 w-16 shrink-0" />
              <Skeleton className="h-3 max-w-[180px] flex-1" />
              <Skeleton className="hidden h-3 w-16 shrink-0 md:block" />
              <Skeleton className="hidden h-4 w-14 shrink-0 rounded-md md:block" />
              <Skeleton className="hidden h-3 w-24 shrink-0 sm:block" />
              <Skeleton className="ml-auto size-8 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BookingsCalendarSkeleton({
  gridOnly = false,
  compact = false,
}: {
  gridOnly?: boolean;
  compact?: boolean;
} = {}) {
  const cellClass = compact
    ? 'h-[3rem] w-full self-start'
    : 'aspect-square min-h-[4.5rem] w-full self-start';
  const gridPad = compact ? 'p-1.5 sm:p-2' : 'p-2 sm:p-3';

  const grid = (
    <div
      className={
        gridOnly
          ? 'overflow-hidden'
          : 'border-border/50 bg-card overflow-hidden rounded-xl border shadow-sm lg:col-span-2 dark:shadow-none'
      }
    >
      {!gridOnly || !compact ? (
        <div className="border-separator bg-muted/30 flex items-center justify-between border-b px-3 py-3 sm:px-4">
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-1">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
        </div>
      ) : null}
      <div className={gridPad}>
        <div className="border-border/50 overflow-hidden rounded-lg border">
          <div className="bg-border/40 grid grid-cols-7 gap-px border-b">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`dow-${i}`} className="mx-auto my-2 h-3 w-6 rounded-full" />
            ))}
          </div>
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, week) => (
              <div
                key={`week-${week}`}
                className="bg-border/40 border-border/40 grid grid-cols-7 gap-px border-t first:border-t-0"
              >
                {Array.from({ length: 7 }).map((_, day) => (
                  <Skeleton key={`day-${week}-${day}`} className={cn(cellClass, 'rounded-none')} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (gridOnly) {
    return (
      <div aria-busy="true" aria-label="Loading calendar">
        {grid}
      </div>
    );
  }

  return (
    <div
      className="grid gap-3 sm:gap-4 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading calendar"
    >
      {grid}
      <div className="border-border/50 bg-card overflow-hidden rounded-xl border shadow-sm dark:shadow-none">
        <div className="border-separator bg-muted/30 border-b px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1.5 h-3 w-32" />
        </div>
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </div>
    </div>
  );
}

type DashboardCardHeaderAction = 'toggle' | 'view' | 'badge' | 'segment';

function DashboardChartCardHeaderSkeleton({
  action,
  titleWidthClass = 'w-28',
  descriptionWidthClass = 'w-40',
}: {
  action?: DashboardCardHeaderAction;
  titleWidthClass?: string;
  descriptionWidthClass?: string;
}) {
  return (
    <div className="mb-2.5 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
        <div className="min-w-0 space-y-1">
          <Skeleton className={cn('h-4 lg:h-5', titleWidthClass)} />
          <Skeleton className={cn('hidden h-3 max-w-full lg:block', descriptionWidthClass)} />
        </div>
      </div>
      {action === 'toggle' ? (
        <Skeleton className="h-9 w-[7.25rem] shrink-0 rounded-lg" />
      ) : action === 'view' ? (
        <Skeleton className="h-9 w-14 shrink-0 rounded-lg" />
      ) : action === 'badge' ? (
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      ) : action === 'segment' ? (
        <Skeleton className="h-9 w-36 shrink-0 rounded-lg" />
      ) : null}
    </div>
  );
}

function DashboardTrendStatCardSkeleton() {
  return <AdminMetricCardSkeleton showTrend />;
}

function DashboardListRowSkeleton({ tall = false }: { tall?: boolean }) {
  return <Skeleton className={cn('w-full rounded-xl', tall ? 'h-14' : 'h-12')} />;
}

export function DashboardSkeleton() {
  return (
    <div
      className="native-stagger flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <section aria-hidden>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <DashboardTrendStatCardSkeleton key={`trend-${i}`} />
          ))}
        </div>
      </section>

      <div className="grid min-w-0 items-stretch gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Calendar | Needs attention */}
        <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton
            action="toggle"
            titleWidthClass="w-24"
            descriptionWidthClass="w-52"
          />
          <div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1 pt-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`dow-${i}`} className="mx-auto h-3 w-6 rounded-full" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={`day-${i}`} className="h-[3rem] w-full self-start rounded-md" />
            ))}
          </div>
        </section>

        <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton
            action="badge"
            titleWidthClass="w-32"
            descriptionWidthClass="w-44"
          />
          <div className="border-border/50 mb-3 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <div className="border-border/50 overflow-hidden rounded-xl border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`attn-${i}`}
                className={cn('px-3 py-2.5', i > 0 && 'border-border/50 border-t')}
              >
                <Skeleton className="h-4 w-full" style={{ opacity: 1 - i * 0.1 }} />
              </div>
            ))}
          </div>
        </section>

        {/* Cash flow | Breakdown */}
        <section className="surface-card flex h-full min-w-0 flex-col p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton
            action="view"
            titleWidthClass="w-24"
            descriptionWidthClass="w-48"
          />
          <Skeleton className="h-[180px] w-full min-w-0 rounded-xl sm:h-[220px]" />
        </section>

        <section className="surface-card flex h-full min-w-0 flex-col p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton action="segment" titleWidthClass="w-28" />
          <div className="flex min-h-[180px] flex-1 items-center justify-center px-2 sm:min-h-[220px]">
            <Skeleton className="size-36 shrink-0 rounded-full sm:size-44" />
          </div>
        </section>

        {/* Maintenance | Transactions */}
        <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton
            action="view"
            titleWidthClass="w-28"
            descriptionWidthClass="w-36"
          />
          <div className="mb-3 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <DashboardListRowSkeleton key={`maint-${i}`} tall />
            ))}
          </div>
        </section>

        <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton
            action="view"
            titleWidthClass="w-28"
            descriptionWidthClass="w-40"
          />
          <div className="mb-3 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <DashboardListRowSkeleton key={`txn-${i}`} tall />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Shown while access is still resolving, before the target page's shape is known. */
export function RouteGuardSkeleton({ fullScreen = false }: { fullScreen?: boolean } = {}) {
  return <AppLoader fullScreen={fullScreen} />;
}

/** Generic block of content rows — settings sections, modal bodies, misc panel content whose shape isn't worth a bespoke skeleton. */
export function SectionContentSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
} = {}) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

/** Avatar/icon + two-line list rows — notification panels, picker dialogs, list-shaped modal content. */
export function ListRowsSkeleton({
  rows = 5,
  label = 'Loading',
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
} = {}) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5" style={{ opacity: 1 - i * 0.08 }}>
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3 max-w-full" />
            <Skeleton className="h-2.5 w-1/2 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches OrgPropertyCard/OrgParkingCard's grid shape (image top, status badge, title/subtitle,
 * 3-col stats footer) — default grid view of OrgPropertiesPage, OrgParkingsPage,
 * SuperAdminHostShell (Properties mode). */
export function ListingCardGridSkeleton({
  count = 8,
  label = 'Loading listings',
  hideStats = false,
}: {
  count?: number;
  label?: string;
  hideStats?: boolean;
} = {}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border-border/50 bg-card overflow-hidden rounded-xl border"
          style={{ opacity: 1 - i * 0.05 }}
        >
          <Skeleton className="aspect-[5/4] w-full rounded-none" />
          <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-2/3 max-w-full" />
              <Skeleton className="h-3.5 w-1/2 max-w-full" />
              <Skeleton className="h-3 w-3/4 max-w-full" />
            </div>
            {hideStats ? null : (
              <div className="border-border/50 grid grid-cols-3 gap-1 border-t pt-2.5 text-center sm:gap-2 sm:pt-3">
                {Array.from({ length: 3 }).map((__, col) => (
                  <div key={col} className="space-y-1">
                    <Skeleton className="mx-auto h-2 w-10" />
                    <Skeleton className="mx-auto h-3 w-8" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches SuperAdminHostOrgCard's shape (icon well + title/subtitle + two stat chips) in its
 * `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` card grid. */
export function HostOrgCardGridSkeleton({
  count = 6,
  label = 'Loading organizations',
}: {
  count?: number;
  label?: string;
} = {}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border-border/50 bg-card flex items-start gap-3 rounded-xl border p-4 sm:p-5"
          style={{ opacity: 1 - i * 0.06 }}
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-2/3 max-w-full" />
              <Skeleton className="h-2.5 w-1/2 max-w-full" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Recurring-series modal table — Date [+Amount] | Notes(sm) | Actions, sticky header. */
export function RecurringSeriesTableSkeleton({ showAmount = true }: { showAmount?: boolean } = {}) {
  return (
    <div
      className="surface-card surface-card-clip flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-label="Loading series"
    >
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="border-separator bg-card sticky top-0 z-10 flex items-center gap-4 border-b px-3 py-2 sm:px-3">
          <Skeleton className="h-2.5 w-16 shrink-0 rounded-full" />
          {showAmount ? <Skeleton className="h-2.5 w-14 shrink-0 rounded-full" /> : null}
          <Skeleton className="hidden h-2.5 max-w-[140px] flex-1 rounded-full sm:block" />
          <Skeleton className="ml-auto h-2.5 w-8 shrink-0 rounded-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-4 px-3 py-2.5',
              i > 0 && 'border-separator border-t'
            )}
            style={{ opacity: 1 - i * 0.08 }}
          >
            <Skeleton className="h-3 w-20 shrink-0" />
            {showAmount ? <Skeleton className="h-3 w-14 shrink-0" /> : null}
            <Skeleton className="hidden h-3 max-w-[140px] flex-1 sm:block" />
            <Skeleton className="ml-auto size-8 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Small aspect-ratio placeholder for document/image thumbnails. */
export function DocThumbnailSkeleton({ className }: { className?: string } = {}) {
  return <Skeleton className={cn('aspect-video w-full rounded-lg', className)} />;
}

/** Larger centered placeholder for modal/panel media previews (PDF, image, asset viewer). */
export function MediaPreviewSkeleton({ className }: { className?: string } = {}) {
  return (
    <div
      className={cn('flex items-center justify-center py-6', className)}
      aria-busy="true"
      aria-label="Loading preview"
    >
      <Skeleton className="aspect-[3/4] w-full max-w-md rounded-xl" />
    </div>
  );
}

/** Team page (org/parking/property) — stat card strip + tab row + member list card. */
export function TeamPageSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4" aria-busy="true" aria-label="Loading team">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - i * 0.05 } as CSSProperties} />
        ))}
      </div>
      <div className="bg-muted inline-flex h-9 w-full items-center gap-1 rounded-lg p-1 sm:w-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 flex-1 rounded-md sm:w-24 sm:flex-none" />
        ))}
      </div>
      <div className="border-border/50 bg-card rounded-xl border">
        <div className="space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Skeleton className="h-4 w-32 shrink-0" />
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <Skeleton className="h-8 w-full rounded-lg sm:w-[260px]" />
              <Skeleton className="h-8 w-full rounded-lg sm:w-[136px]" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5 px-4 pb-4 pt-0 sm:space-y-2 sm:px-6 sm:pb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-border/60 flex items-center gap-2.5 rounded-lg border px-2.5 py-2 sm:gap-3 sm:p-3"
              style={{ opacity: 1 - i * 0.08 }}
            >
              <Skeleton className="size-8 shrink-0 rounded-full sm:size-9" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/3 max-w-full" />
                <Skeleton className="h-2.5 w-1/2 max-w-full" />
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 shrink-0 rounded-md sm:w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Org dashboard — KPI strip + 2×2 board + listings list. */
export function OrgDashboardSkeleton() {
  return (
    <div
      className="native-stagger flex min-w-0 flex-col gap-2.5 sm:gap-3 lg:gap-4"
      aria-busy="true"
      aria-label="Loading organization dashboard"
    >
      <section aria-hidden>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <DashboardTrendStatCardSkeleton key={`org-trend-${i}`} />
          ))}
        </div>
      </section>

      <div className="grid min-w-0 items-stretch gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-4">
        <section className="surface-card flex h-full min-w-0 flex-col p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton action="segment" titleWidthClass="w-32" />
          <Skeleton className="h-[180px] w-full min-w-0 rounded-xl sm:h-[220px]" />
        </section>

        <section className="surface-card flex h-full min-w-0 flex-col p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton titleWidthClass="w-28" />
          <div className="flex min-h-[220px] flex-1 items-center justify-center sm:min-h-[260px]">
            <Skeleton className="size-40 shrink-0 rounded-full sm:size-48" />
          </div>
        </section>

        <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton action="view" titleWidthClass="w-32" />
          <div className="border-border/50 overflow-hidden rounded-xl border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`org-recent-${i}`}
                className={cn('px-3 py-2.5', i > 0 && 'border-border/50 border-t')}
              >
                <Skeleton className="h-3.5 w-full" style={{ opacity: 1 - i * 0.1 }} />
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card flex h-full min-w-0 flex-col overflow-hidden p-3 sm:p-4">
          <DashboardChartCardHeaderSkeleton action="view" titleWidthClass="w-28" />
          <div className="border-border/50 overflow-hidden rounded-xl border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`org-pending-${i}`}
                className={cn('px-3 py-2.5', i > 0 && 'border-border/50 border-t')}
              >
                <Skeleton className="h-4 w-full" style={{ opacity: 1 - i * 0.1 }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="surface-card min-w-0 overflow-hidden p-3 sm:p-4">
        <DashboardChartCardHeaderSkeleton action="segment" titleWidthClass="w-40" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <DashboardListRowSkeleton key={`org-listing-${i}`} tall />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Marketing design/video studio chrome — sidebar + canvas, responsive. */
export function MarketingStudioSkeleton() {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 lg:flex-row"
      aria-busy="true"
      aria-label="Loading editor"
    >
      <aside className="border-border/60 flex w-full shrink-0 flex-col gap-3 border-b p-3 sm:p-4 lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-2 pt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </aside>
      <div className="bg-muted/30 flex min-h-[min(60dvh,28rem)] min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
        <div className="mt-3 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-20 shrink-0 rounded-lg sm:h-16 sm:w-24" />
          ))}
        </div>
      </div>
    </div>
  );
}
