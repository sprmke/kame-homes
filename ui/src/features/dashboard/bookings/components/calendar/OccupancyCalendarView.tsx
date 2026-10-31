import { useMemo, useState, type ReactNode } from 'react';

import { format } from 'date-fns';

import { buildOccupancyByDay } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import type {
  CalendarVisibleRange,
  OccupancySegment,
} from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { CalendarDayDetailPanel } from '@/features/dashboard/bookings/components/calendar/CalendarDayDetailPanel';
import { CalendarMonthGrid } from '@/features/dashboard/bookings/components/calendar/CalendarMonthGrid';
import { CalendarYearGrid } from '@/features/dashboard/bookings/components/calendar/CalendarYearGrid';
import { statusToneStyle } from '@/features/dashboard/bookings/components/StatusBadge';

import { BookingsCalendarSkeleton } from '@/components/skeletons/AdminSkeletons';
import type { DatePreset } from '@/lib/date/navigation';
import { cn } from '@/lib/utils';

export const CALENDAR_OCCUPANCY_LIMIT = 100;

type OccupancyRow = {
  check_in_date: string;
  check_out_date: string;
};

type Props<T extends OccupancyRow> = {
  rows: T[];
  isLoading: boolean;
  error: string | null;
  isRefreshing?: boolean;
  getItemKey: (item: T) => string;
  getItemStatus: (item: T) => string;
  renderPill: (item: T) => ReactNode;
  /** When set, renders multi-night bars; falls back to per-cell pills if omitted. */
  renderOccupancySegment?: (segment: OccupancySegment<T>) => ReactNode;
  renderDayItem: (item: T) => ReactNode;
  entityLabel: string;
  entityLabelSingular?: string;
  initialMonth?: Date;
  onMonthChange?: (month: Date) => void;
  emptySelectCaption?: string;
  emptyDayCaption?: string;
  /** Grid only — no day-detail sidebar (dashboard mini calendar). */
  layout?: 'full' | 'grid-only';
  compact?: boolean;
  embedded?: boolean;
  onDayClick?: (day: Date, items: T[]) => void;
  onItemClick?: (item: T) => void;
  /** Dashboard: drive grid from global date filter instead of internal month nav. */
  visibleRange?: CalendarVisibleRange;
  datePreset?: DatePreset;
  hideNavigation?: boolean;
  /** Optional control beside month nav (e.g. Name/Price toggle). */
  navigationAccessory?: ReactNode;
};

export function OccupancyCalendarView<T extends OccupancyRow>({
  rows,
  isLoading,
  error,
  isRefreshing,
  getItemKey,
  getItemStatus,
  renderPill,
  renderOccupancySegment,
  renderDayItem,
  entityLabel,
  entityLabelSingular,
  initialMonth,
  onMonthChange,
  emptySelectCaption,
  emptyDayCaption,
  layout = 'full',
  compact = false,
  embedded = false,
  onDayClick,
  onItemClick,
  visibleRange,
  datePreset,
  hideNavigation = false,
  navigationAccessory,
}: Props<T>) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const singular = entityLabelSingular ?? entityLabel.replace(/s$/, '');

  const itemsByDay = useMemo(
    () =>
      buildOccupancyByDay(
        rows,
        (row) => row.check_in_date,
        (row) => row.check_out_date
      ),
    [rows]
  );

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [];
    return itemsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [];
  }, [selectedDay, itemsByDay]);

  if (error) {
    return (
      <div className="bg-card border-border/50 flex flex-col items-center justify-center gap-3 rounded-xl border py-20 text-center">
        <div className="flex size-9 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/15">
          <span className="text-base font-black leading-none text-red-500">!</span>
        </div>
        <div>
          <p className="text-foreground text-[14px] font-bold">Could not load {entityLabel}</p>
          <p className="text-muted-foreground mt-1 max-w-xs text-[12px]">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('transition-opacity duration-300', isRefreshing && 'opacity-60')}>
        <BookingsCalendarSkeleton gridOnly={layout === 'grid-only'} compact={compact} />
      </div>
    );
  }

  const grid =
    visibleRange && datePreset === 'year' ? (
      <CalendarYearGrid
        visibleRange={visibleRange}
        itemsByDay={itemsByDay}
        getItemKey={getItemKey}
        getItemStatus={getItemStatus}
        entityLabel={singular}
        onDayClick={onDayClick}
      />
    ) : (
      <CalendarMonthGrid
        itemsByDay={itemsByDay}
        occupancyRows={renderOccupancySegment ? rows : undefined}
        getCheckIn={renderOccupancySegment ? (row) => row.check_in_date : undefined}
        getCheckOut={renderOccupancySegment ? (row) => row.check_out_date : undefined}
        renderOccupancySegment={renderOccupancySegment}
        maxSpanLanes={compact ? 1 : 2}
        getItemKey={getItemKey}
        getItemStatus={getItemStatus}
        renderPill={renderPill}
        entityLabel={singular}
        initialMonth={initialMonth}
        onMonthChange={(month) => {
          onMonthChange?.(month);
          setSelectedDay(null);
        }}
        selectedDay={selectedDay}
        onSelectedDayChange={setSelectedDay}
        visibleRange={visibleRange}
        hideNavigation={hideNavigation}
        compact={compact}
        embedded={embedded}
        onDayClick={onDayClick}
        onItemClick={onItemClick}
        navigationAccessory={navigationAccessory}
      />
    );

  if (layout === 'grid-only') {
    return (
      <div className={cn('min-w-0 transition-opacity duration-300', isRefreshing && 'opacity-60')}>
        {grid}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-3 transition-opacity duration-300 sm:gap-4 lg:grid-cols-3',
        isRefreshing && 'opacity-60'
      )}
    >
      {grid}

      <CalendarDayDetailPanel
        selectedDay={selectedDay}
        count={selectedDayItems.length}
        entityLabel={singular}
        emptySelectCaption={
          emptySelectCaption ?? `Click any day to see ${entityLabel} with a stay that night`
        }
        emptyDayCaption={emptyDayCaption ?? `No guest ${entityLabel} are scheduled for this night`}
      >
        <div className="space-y-2">
          {selectedDayItems.map((item) => (
            <div key={getItemKey(item)}>{renderDayItem(item)}</div>
          ))}
        </div>
      </CalendarDayDetailPanel>
    </div>
  );
}

/** Status-colored occupancy pill with a custom label (guest first name or stay total). */
export function occupancySpanRoundedClass(
  spanPosition: import('@/features/dashboard/bookings/components/calendar/calendarDateUtils').CalendarOccupancySpanPosition,
  compact = false
): string {
  if (compact) {
    if (spanPosition === 'start') return 'rounded-l-full rounded-r-sm';
    if (spanPosition === 'end') return 'rounded-r-full rounded-l-sm';
    if (spanPosition === 'middle') return 'rounded-sm';
    return 'rounded-full';
  }
  if (spanPosition === 'start') return 'rounded-l-md rounded-r-sm';
  if (spanPosition === 'end') return 'rounded-r-md rounded-l-sm';
  if (spanPosition === 'middle') return 'rounded-sm';
  return 'rounded-md';
}

export function CalendarOccupancyPill({
  status,
  label,
  title,
  labelClassName,
  spanPosition = 'single',
  showLabel = true,
  compact = false,
  className,
}: {
  status: string;
  label: string;
  title?: string;
  labelClassName?: string;
  spanPosition?: import('@/features/dashboard/bookings/components/calendar/calendarDateUtils').CalendarOccupancySpanPosition;
  showLabel?: boolean;
  /** Dashboard mini calendar — denser stay band under the date strip. */
  compact?: boolean;
  className?: string;
}) {
  const tone = statusToneStyle(status);
  const roundedClass = occupancySpanRoundedClass(spanPosition, compact);

  return (
    <div
      className={cn(
        'flex min-w-0 items-center truncate border shadow-sm',
        compact
          ? 'h-[14px] gap-1 px-1.5 text-[10px] font-semibold leading-none tracking-tight'
          : 'h-full gap-1 px-1.5 py-0.5 text-[10px] font-semibold leading-tight',
        roundedClass,
        tone.badge,
        /* Multi-week fragments: keep status border on outer edges only (no join seams) */
        spanPosition === 'middle' && 'border-x-0 shadow-none',
        spanPosition === 'start' && 'border-r-0',
        spanPosition === 'end' && 'border-l-0',
        className
      )}
      title={title}
    >
      {showLabel ? (
        <>
          <span
            aria-hidden
            className={cn(
              'shrink-0 rounded-full',
              compact ? 'size-1' : 'size-1.5',
              tone.dot,
              tone.pulse && 'motion-safe:animate-pulse'
            )}
          />
          <span className={cn('min-w-0 truncate', labelClassName)}>{label}</span>
        </>
      ) : (
        <span aria-hidden className={cn('block w-full', compact ? 'min-h-2.5' : 'min-h-[10px]')} />
      )}
    </div>
  );
}
