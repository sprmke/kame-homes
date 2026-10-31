import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { addDays, addWeeks, format, isSameDay, isToday, startOfDay, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  CALENDAR_GRID_HOUR_END,
  CALENDAR_GRID_HOUR_START,
  CALENDAR_GRID_TOP_GUTTER_PX,
  CALENDAR_PX_PER_HOUR,
  buildTimedSlicesForDay,
  calendarGridBodyHeightPx,
  calendarGridHours,
  dayKey,
  durationToHeightPx,
  formatHourLabel,
  markClashingRows,
  minutesToTopPx,
  weekDaysFor,
  type TimedStaySlice,
  type TimedStaySpanPosition,
} from '@/features/dashboard/bookings/components/calendar/calendarTimeGridUtils';
import { statusToneStyle } from '@/features/dashboard/bookings/components/StatusBadge';
import { statusTone } from '@/features/dashboard/bookings/lib/bookingStatus';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { STATUS_TONE_CALENDAR_BLOCK } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

type Props<T> = {
  period: 'week' | 'day';
  rows: T[];
  anchorDate: Date;
  onAnchorDateChange: (next: Date) => void;
  /** Week view: clicking a day header opens that day. */
  onRequestDayView?: (day: Date) => void;
  getItemKey: (item: T) => string;
  getItemStatus: (item: T) => string;
  getCheckIn: (item: T) => string | null | undefined;
  getCheckOut: (item: T) => string | null | undefined;
  getCheckInTime: (item: T) => string | null | undefined;
  getCheckOutTime: (item: T) => string | null | undefined;
  renderBlockLabel: (item: T) => string;
  /** Native title fallback when `renderTooltipContent` is omitted. */
  renderBlockTitle?: (item: T) => string;
  /** Pricing-style rich tooltip body (preferred). */
  renderTooltipContent?: (item: T) => ReactNode;
  onItemClick?: (item: T) => void;
  navigationAccessory?: ReactNode;
  className?: string;
};

function CurrentTimeLine({ day }: { day: Date }) {
  const now = new Date();
  if (!isSameDay(day, now)) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < CALENDAR_GRID_HOUR_START * 60 || minutes >= CALENDAR_GRID_HOUR_END * 60) {
    return null;
  }
  const top = minutesToTopPx(minutes);
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top }} aria-hidden>
      <div className="bg-destructive relative h-px w-full">
        <span className="bg-destructive absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full" />
      </div>
    </div>
  );
}

function spanRoundedClass(spanPosition: TimedStaySpanPosition, seamless: boolean): string {
  if (!seamless) return 'rounded-md';
  switch (spanPosition) {
    case 'start':
      return 'rounded-l-md rounded-r-none';
    case 'end':
      return 'rounded-r-md rounded-l-none';
    case 'middle':
      return 'rounded-none';
    default:
      return 'rounded-md';
  }
}

function StayBlock<T>({
  slice,
  itemKey,
  getItemStatus,
  renderBlockLabel,
  renderBlockTitle,
  renderTooltipContent,
  onItemClick,
  isClash,
  isHighlighted,
  onHighlight,
}: {
  slice: TimedStaySlice<T>;
  itemKey: string;
  getItemStatus: (item: T) => string;
  renderBlockLabel: (item: T) => string;
  renderBlockTitle?: (item: T) => string;
  renderTooltipContent?: (item: T) => ReactNode;
  onItemClick?: (item: T) => void;
  isClash: boolean;
  isHighlighted: boolean;
  onHighlight: (key: string | null) => void;
}) {
  const status = getItemStatus(slice.item);
  const tone = statusToneStyle(status);
  const blockTone = STATUS_TONE_CALENDAR_BLOCK[statusTone(status)];
  const top = minutesToTopPx(slice.startMin);
  const height = durationToHeightPx(slice.startMin, slice.endMin);
  const widthPct = 100 / slice.columnCount;
  const leftPct = (slice.column / slice.columnCount) * 100;
  const label = renderBlockLabel(slice.item);
  const title = renderBlockTitle?.(slice.item) ?? label;
  const interactive = Boolean(onItemClick);
  const seamless = slice.columnCount === 1 && slice.spanPosition !== 'single';
  const flushLeft = seamless && (slice.spanPosition === 'middle' || slice.spanPosition === 'end');
  const flushRight =
    seamless && (slice.spanPosition === 'middle' || slice.spanPosition === 'start');
  const edgeGap = 3;
  const leftInset = flushLeft ? 0 : edgeGap;
  const rightInset = flushRight ? 0 : edgeGap;
  const tooltipBody = renderTooltipContent?.(slice.item);

  const button = (
    <button
      type="button"
      title={tooltipBody ? undefined : title}
      disabled={!interactive}
      onClick={(event) => {
        event.stopPropagation();
        onItemClick?.(slice.item);
      }}
      onMouseEnter={() => onHighlight(itemKey)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(itemKey)}
      onBlur={() => onHighlight(null)}
      className={cn(
        'absolute z-10 overflow-hidden border text-left shadow-sm',
        'px-1.5 py-1 motion-safe:transition-colors motion-safe:duration-150',
        spanRoundedClass(slice.spanPosition, seamless),
        isHighlighted ? blockTone.hover : blockTone.base,
        /* Multi-day continuity: open the joining side only (status border stays on outer edges) */
        flushLeft && 'border-l-0',
        flushRight && 'border-r-0',
        /* Overlaps are already visible as side-by-side columns — no destructive/primary ring */
        isClash && 'shadow-md',
        isHighlighted && 'z-30',
        interactive
          ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/10'
          : 'cursor-default'
      )}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + ${leftInset}px)`,
        width: `calc(${widthPct}% - ${leftInset + rightInset}px)`,
      }}
      aria-label={title}
    >
      <span className="flex min-w-0 items-start gap-1">
        <span aria-hidden className={cn('mt-0.5 size-1.5 shrink-0 rounded-full', tone.dot)} />
        <span className="min-w-0 truncate text-[10px] font-semibold leading-tight">{label}</span>
      </span>
      {height >= 40 ? (
        <span className="mt-0.5 block truncate pl-2.5 text-[9px] font-medium tabular-nums opacity-75">
          {formatHourLabel(Math.floor(slice.startMin / 60))}
          {' – '}
          {formatHourLabel(Math.min(23, Math.floor((slice.endMin - 1) / 60)))}
        </span>
      ) : null}
    </button>
  );

  if (!tooltipBody) return button;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" className="px-3 py-2.5">
        {tooltipBody}
      </TooltipContent>
    </Tooltip>
  );
}

export function CalendarTimeGrid<T>({
  period,
  rows,
  anchorDate,
  onAnchorDateChange,
  onRequestDayView,
  getItemKey,
  getItemStatus,
  getCheckIn,
  getCheckOut,
  getCheckInTime,
  getCheckOutTime,
  renderBlockLabel,
  renderBlockTitle,
  renderTooltipContent,
  onItemClick,
  navigationAccessory,
  className,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const hours = useMemo(() => calendarGridHours(), []);
  const gridHeight = calendarGridBodyHeightPx();

  const days = useMemo(() => {
    if (period === 'day') return [startOfDay(anchorDate)];
    return weekDaysFor(anchorDate);
  }, [period, anchorDate]);

  const clashKeys = useMemo(
    () =>
      markClashingRows(rows, getCheckIn, getCheckOut, getCheckInTime, getCheckOutTime, getItemKey),
    [rows, getCheckIn, getCheckOut, getCheckInTime, getCheckOutTime, getItemKey]
  );

  const slicesByDay = useMemo(() => {
    const map = new Map<string, TimedStaySlice<T>[]>();
    for (const day of days) {
      map.set(
        dayKey(day),
        buildTimedSlicesForDay(rows, day, getCheckIn, getCheckOut, getCheckInTime, getCheckOutTime)
      );
    }
    return map;
  }, [days, rows, getCheckIn, getCheckOut, getCheckInTime, getCheckOutTime]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const offset =
      CALENDAR_GRID_TOP_GUTTER_PX + (7 - CALENDAR_GRID_HOUR_START) * CALENDAR_PX_PER_HOUR;
    node.scrollTop = Math.max(0, offset - CALENDAR_GRID_TOP_GUTTER_PX);
  }, [period, anchorDate]);

  const title =
    period === 'day'
      ? format(anchorDate, 'EEEE, MMM d, yyyy')
      : `${format(days[0], 'MMM d')} – ${format(days[6], 'MMM d, yyyy')}`;

  const navigate = (direction: 'prev' | 'next') => {
    if (period === 'day') {
      onAnchorDateChange(addDays(anchorDate, direction === 'prev' ? -1 : 1));
      return;
    }
    onAnchorDateChange(direction === 'prev' ? subWeeks(anchorDate, 1) : addWeeks(anchorDate, 1));
  };

  const goToday = () => onAnchorDateChange(new Date());
  const columnsTemplate = `3.5rem repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'bg-card border-border/50 flex flex-col overflow-hidden rounded-xl border shadow-sm dark:shadow-none',
          className
        )}
      >
        <div className="border-separator bg-muted/30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
          <h2 className="text-foreground text-[14px] font-bold">{title}</h2>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            {navigationAccessory}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate('prev')}
                aria-label={period === 'day' ? 'Previous day' : 'Previous week'}
                className={cn(
                  'inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg',
                  'bg-card text-sidebar-muted border-sidebar-border border',
                  'hover:border-sidebar-primary/40 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50',
                  'transition-all duration-100'
                )}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={goToday}
                className={cn(
                  'inline-flex min-h-[36px] items-center justify-center rounded-lg px-2.5 text-[12px] font-semibold',
                  'bg-card text-sidebar-muted border-sidebar-border border',
                  'hover:border-sidebar-primary/40 hover:bg-sidebar-accent/50 transition-all duration-100'
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => navigate('next')}
                aria-label={period === 'day' ? 'Next day' : 'Next week'}
                className={cn(
                  'inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg',
                  'bg-card text-sidebar-muted border-sidebar-border border',
                  'hover:border-sidebar-primary/40 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50',
                  'transition-all duration-100'
                )}
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* Opaque day strip stays outside the scrollport so it never covers hour rows */}
        <div
          className="border-border/50 bg-card relative z-10 grid shrink-0 border-b"
          style={{ gridTemplateColumns: columnsTemplate }}
        >
          <div className="border-border/40 border-r" aria-hidden />
          {days.map((day) => {
            const todayFlag = isToday(day);
            const count = slicesByDay.get(dayKey(day))?.length ?? 0;
            return (
              <button
                key={dayKey(day)}
                type="button"
                onClick={() => {
                  if (period === 'week' && onRequestDayView) {
                    onRequestDayView(day);
                    return;
                  }
                  onAnchorDateChange(day);
                }}
                className={cn(
                  'border-border/40 flex flex-col items-center gap-0.5 border-r px-1 py-2 last:border-r-0',
                  'hover:bg-muted/40 bg-card transition-colors',
                  todayFlag && 'bg-sidebar-accent/30'
                )}
                aria-label={`${format(day, 'EEEE, MMMM d')}${count ? `, ${count} stays` : ''}`}
              >
                <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                  {format(day, 'EEE')}
                </span>
                <span
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums',
                    todayFlag ? 'gradient-primary text-primary-foreground' : 'text-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>

        <div
          ref={scrollRef}
          className="relative z-0 max-h-[min(70vh,720px)] min-h-0 flex-1 overflow-auto"
        >
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: columnsTemplate,
              height: gridHeight,
            }}
          >
            <div className="border-border/40 relative border-r" style={{ height: gridHeight }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-muted-foreground absolute right-1 -translate-y-1/2 text-[10px] font-medium tabular-nums"
                  style={{
                    top:
                      CALENDAR_GRID_TOP_GUTTER_PX +
                      (hour - CALENDAR_GRID_HOUR_START) * CALENDAR_PX_PER_HOUR,
                  }}
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const slices = slicesByDay.get(dayKey(day)) ?? [];
              return (
                <div
                  key={dayKey(day)}
                  className="border-border/40 relative border-r last:border-r-0"
                  style={{ height: gridHeight }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-border/30 absolute inset-x-0 border-t"
                      style={{
                        top:
                          CALENDAR_GRID_TOP_GUTTER_PX +
                          (hour - CALENDAR_GRID_HOUR_START) * CALENDAR_PX_PER_HOUR,
                        height: CALENDAR_PX_PER_HOUR,
                      }}
                      aria-hidden
                    />
                  ))}
                  <CurrentTimeLine day={day} />
                  {slices.map((slice) => {
                    const key = getItemKey(slice.item);
                    return (
                      <StayBlock
                        key={`${key}-${slice.startMin}-${slice.endMin}`}
                        slice={slice}
                        itemKey={key}
                        getItemStatus={getItemStatus}
                        renderBlockLabel={renderBlockLabel}
                        renderBlockTitle={renderBlockTitle}
                        renderTooltipContent={renderTooltipContent}
                        onItemClick={onItemClick}
                        isClash={clashKeys.has(key)}
                        isHighlighted={highlightedKey === key}
                        onHighlight={setHighlightedKey}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
