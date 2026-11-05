import { eachDayOfInterval, endOfMonth, format, getDay, isSameMonth, startOfMonth } from 'date-fns';
import { Ban, Calendar, DollarSign, PenLine, Sparkles, Tag, TrendingUp, Wand2 } from 'lucide-react';

import { buildCalendarWeekRows } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import {
  pricingCalendarFormGridClassName,
  pricingCalendarOutsideCellClassName,
  pricingCalendarWeekGapClassName,
  pricingRatesFormStackClassName,
  pricingRatesFormSurfaceClassName,
} from '@/features/dashboard/pricing/lib/pricingCalendarLayout';

import { StatCardSkeleton } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const PROPERTY_STATS = [
  { title: 'Base Rate', icon: DollarSign },
  { title: 'Weekend Premium', icon: TrendingUp },
  { title: 'Custom Dates', icon: Calendar },
  { title: 'Fixed Fees', icon: Tag },
  { title: 'Smart Pricing', icon: Wand2 },
] as const;

const PARKING_STATS = PROPERTY_STATS.slice(0, 3);

/** One `MoneyInput`: label, ₱ input, optional helper line (parking shows payout copy). */
function MoneyInputSkeleton({ helper = false }: { helper?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-10 w-full rounded-lg" />
      {helper ? <Skeleton className="h-4 w-48 max-w-full" /> : null}
    </div>
  );
}

/**
 * `PricingRatesFormCard` / `ParkingPricingRatesFormCard`: Base rates (2 inputs), then the
 * property fees list, or the parking per-input payout helper lines.
 */
function RatesFormSkeleton({
  parking = false,
  feeCount = 5,
  className,
}: {
  parking?: boolean;
  feeCount?: number;
  className?: string;
}) {
  const compactChrome = useDashboardCompactChrome();

  return (
    <section className={cn(pricingRatesFormSurfaceClassName(compactChrome), className)} aria-hidden>
      <div className={pricingRatesFormStackClassName(compactChrome)}>
        <div>
          <h3 className="text-foreground text-sm font-semibold">Base rates</h3>
          <div className="mt-3 space-y-4">
            <MoneyInputSkeleton helper={parking} />
            <MoneyInputSkeleton helper={parking} />
          </div>
        </div>

        {parking ? null : (
          <>
            <div className="border-border/60 border-t" role="separator" />
            <div>
              <h3 className="text-foreground text-sm font-semibold">Fees</h3>
              <ul className="mt-3 space-y-4">
                {Array.from({ length: feeCount }).map((_, index) => (
                  <li key={index}>
                    <MoneyInputSkeleton />
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** `ParkingDirectLinkCard`: title, commission line, copy button (URL hidden until loaded). */
function DirectLinkCardSkeleton() {
  return (
    <section className="surface-card p-4 sm:p-5" aria-hidden>
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-foreground text-sm font-semibold">Direct booking link</h3>
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </section>
  );
}

function PricingDayCellSkeleton({ dense, dayNumber }: { dense: boolean; dayNumber: number }) {
  return (
    <div
      className={cn(
        'border-border bg-card relative flex aspect-square min-w-0 flex-col rounded-lg border',
        dense
          ? 'min-h-[3rem] p-0.5 sm:min-h-[3.25rem]'
          : 'min-h-[3.5rem] p-1 sm:min-h-[4.5rem] sm:p-2'
      )}
    >
      <span className="text-foreground text-xs font-semibold leading-none sm:text-sm">
        {dayNumber}
      </span>
      <Skeleton className="mt-auto h-3.5 w-full rounded sm:h-5" />
    </div>
  );
}

/**
 * `PricingCalendarGrid`: card header (title + month stepper), day-of-week row, the
 * month's real week rows with day number + price pill, then the desktop legend.
 * Uses the live month so 5- and 6-week months keep the same card height.
 */
function PricingCalendarCardSkeleton() {
  const isBelowLg = useIsBelowLg();
  const compactChrome = useDashboardCompactChrome();
  const denseCalendar = isBelowLg || compactChrome;

  const monthStart = startOfMonth(new Date());
  const daysInMonth = eachDayOfInterval({
    start: monthStart,
    end: endOfMonth(monthStart),
  });
  const weeks = buildCalendarWeekRows(daysInMonth, getDay(monthStart));

  return (
    <section
      className={cn('surface-card min-w-0', denseCalendar ? 'p-3 sm:p-4' : 'p-4 sm:p-5')}
      aria-hidden
    >
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2 sm:mb-3 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="icon-well-sm bg-muted/80 inline-flex !size-8 shrink-0 items-center justify-center !rounded-lg lg:!size-10 lg:!rounded-xl">
            <Calendar className="text-muted-foreground size-4 lg:size-5" aria-hidden />
          </div>
          <p className="text-card-title">
            <span className="sm:hidden">Pricing</span>
            <span className="hidden sm:inline">Pricing &amp; Availability</span>
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Skeleton className="size-8 shrink-0 rounded-md sm:size-9" />
          <span
            className={cn(
              'truncate text-center text-[13px] font-semibold tabular-nums sm:text-sm',
              denseCalendar
                ? 'min-w-[5.25rem] sm:min-w-[5.75rem]'
                : 'min-w-[5.75rem] sm:min-w-[9.5rem]'
            )}
          >
            {format(monthStart, denseCalendar ? 'MMM yyyy' : 'MMMM yyyy')}
          </span>
          <Skeleton className="size-8 shrink-0 rounded-md sm:size-9" />
        </div>
      </div>

      <div className={cn('mb-2 grid grid-cols-7', pricingCalendarWeekGapClassName(denseCalendar))}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label} className="text-muted-foreground py-1 text-center text-xs font-medium">
            {label}
          </div>
        ))}
      </div>

      <div className={cn('flex flex-col', denseCalendar ? 'gap-1' : 'gap-1.5 sm:gap-2')}>
        {weeks.map((week) => (
          <div
            key={week.weekIndex}
            className={cn('grid grid-cols-7', pricingCalendarWeekGapClassName(denseCalendar))}
          >
            {week.days.map((day) =>
              isSameMonth(day, monthStart) ? (
                <PricingDayCellSkeleton
                  key={day.toISOString()}
                  dense={denseCalendar}
                  dayNumber={day.getDate()}
                />
              ) : (
                <div
                  key={day.toISOString()}
                  className={pricingCalendarOutsideCellClassName(denseCalendar)}
                />
              )
            )}
          </div>
        ))}
      </div>

      <div className="text-muted-foreground border-border/60 mt-4 hidden flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs lg:flex">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-card ring-border size-2.5 rounded-[3px] ring-1" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center">
            <Sparkles className="text-primary size-3" aria-hidden />
          </span>
          Holiday
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center">
            <PenLine className="size-3 text-amber-600 dark:text-amber-400" aria-hidden />
          </span>
          Custom
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center">
            <Wand2 className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </span>
          Smart Pricing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary ring-primary/20 inline-flex h-2.5 min-w-[1rem] rounded-full shadow-sm ring-1" />
          Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center">
            <Ban className="text-muted-foreground size-3" aria-hidden />
          </span>
          Blocked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="ring-primary size-2.5 rounded-[3px] ring-1" />
          Selected
        </span>
      </div>
    </section>
  );
}

/**
 * Pricing page data region: KPI row (3 parking / 4 property / 5 with Smart Pricing),
 * the pricing calendar card, and the rates column (form + optional direct link card).
 */
export function PricingPageBodySkeleton({
  statsCount = 4,
  showDirectLinkCard = false,
  feeCount = 5,
}: {
  statsCount?: number;
  /** Parking pricing shows the direct booking link card under the rates form. */
  showDirectLinkCard?: boolean;
  /** Property fee rows in the rates form (defaults to the 5 seeded fees). */
  feeCount?: number;
}) {
  const compactChrome = useDashboardCompactChrome();
  const safeCount = Math.min(5, Math.max(3, statsCount));

  return (
    <div
      role="status"
      className="space-y-3 sm:space-y-4"
      aria-busy="true"
      aria-label="Loading pricing"
    >
      <section
        aria-hidden
        className={cn(
          'grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4',
          safeCount === 3 && 'lg:grid-cols-3',
          safeCount === 4 && 'lg:grid-cols-4',
          safeCount === 5 && 'lg:grid-cols-5'
        )}
      >
        {(showDirectLinkCard ? PARKING_STATS : PROPERTY_STATS)
          .slice(0, safeCount)
          .map((metric, index) => (
            <StatCardSkeleton
              key={metric.title}
              title={metric.title}
              icon={metric.icon}
              style={{ opacity: 1 - index * 0.05 }}
            />
          ))}
      </section>

      <div className={pricingCalendarFormGridClassName(compactChrome)}>
        <PricingCalendarCardSkeleton />

        <div className={showDirectLinkCard ? 'space-y-3 lg:sticky lg:top-5' : 'lg:sticky lg:top-5'}>
          <RatesFormSkeleton parking={showDirectLinkCard} feeCount={feeCount} />
          {showDirectLinkCard ? <DirectLinkCardSkeleton /> : null}
        </div>
      </div>
    </div>
  );
}
