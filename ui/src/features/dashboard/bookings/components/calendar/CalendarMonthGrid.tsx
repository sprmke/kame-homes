import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  CALENDAR_WEEKDAYS,
  buildCalendarWeekRows,
  buildOccupancySegmentsForWeeks,
  buildRangeCalendarDays,
  calendarPaddingStart,
  type CalendarVisibleRange,
  type OccupancySegment,
} from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import {
  CalendarOccupancySpanTrack,
  occupancyOverflowByCol,
} from '@/features/dashboard/bookings/components/calendar/CalendarOccupancySpanTrack';
import { statusToneStyle } from '@/features/dashboard/bookings/components/StatusBadge';

import { cn } from '@/lib/utils';

type Props<T> = {
  itemsByDay: Map<string, T[]>;
  getItemKey: (item: T) => string;
  getItemStatus?: (item: T) => string;
  renderPill: (item: T) => ReactNode;
  entityLabel: string;
  initialMonth?: Date;
  onMonthChange?: (month: Date) => void;
  selectedDay: Date | null;
  onSelectedDayChange: (day: Date | null) => void;
  /** When set, render this range instead of a navigable month. */
  visibleRange?: CalendarVisibleRange;
  /** Hide month title + prev/today/next (dashboard uses global date filter). */
  hideNavigation?: boolean;
  /** Compact cells with pills on all breakpoints; for dashboard embeds. */
  compact?: boolean;
  /** Drop outer card chrome when nested inside a parent surface. */
  embedded?: boolean;
  /** When set, day clicks navigate instead of selecting a sidebar day. */
  onDayClick?: (day: Date, items: T[]) => void;
  onItemClick?: (item: T) => void;
  /** Multi-night stays: one bar per row instead of per-cell pills. */
  occupancyRows?: T[];
  getCheckIn?: (item: T) => string | null | undefined;
  getCheckOut?: (item: T) => string | null | undefined;
  renderOccupancySegment?: (segment: OccupancySegment<T>) => ReactNode;
  maxSpanLanes?: number;
  /** Optional control beside the month nav (e.g. Name/Price toggle). */
  navigationAccessory?: ReactNode;
};

export function CalendarMonthGrid<T>({
  itemsByDay,
  getItemKey,
  getItemStatus,
  renderPill,
  entityLabel,
  initialMonth,
  onMonthChange,
  selectedDay,
  onSelectedDayChange,
  visibleRange,
  hideNavigation = false,
  compact = false,
  embedded = false,
  onDayClick,
  onItemClick,
  occupancyRows,
  getCheckIn,
  getCheckOut,
  renderOccupancySegment,
  maxSpanLanes,
  navigationAccessory,
}: Props<T>) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => initialMonth ?? new Date());

  useEffect(() => {
    if (visibleRange) return;
    if (initialMonth) setCurrentMonth(initialMonth);
  }, [initialMonth, visibleRange]);

  const rangeGrid = useMemo(() => {
    if (!visibleRange) return null;
    return buildRangeCalendarDays(visibleRange);
  }, [visibleRange]);

  const calendarGrid = useMemo(() => {
    if (rangeGrid) return rangeGrid;
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    return { days, paddingStart: calendarPaddingStart(start) };
  }, [currentMonth, rangeGrid]);

  const spanMode = Boolean(occupancyRows && getCheckIn && getCheckOut && renderOccupancySegment);

  const weeks = useMemo(
    () => buildCalendarWeekRows(calendarGrid.days, calendarGrid.paddingStart),
    [calendarGrid.days, calendarGrid.paddingStart]
  );

  const segmentsByWeek = useMemo(() => {
    if (!spanMode || !occupancyRows || !getCheckIn || !getCheckOut) return null;
    return buildOccupancySegmentsForWeeks(occupancyRows, weeks, getCheckIn, getCheckOut);
  }, [spanMode, occupancyRows, getCheckIn, getCheckOut, weeks]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (visibleRange) return;
    setCurrentMonth((cur) => {
      const next = direction === 'prev' ? subMonths(cur, 1) : addMonths(cur, 1);
      onMonthChange?.(next);
      return next;
    });
    onSelectedDayChange(null);
  };

  const dayCount = calendarGrid.days.length;
  const dense = compact && dayCount > 31;
  /**
   * Full month: square day cells. Mini (compact): fixed short height so the dashboard
   * embed does not grow with card width and leave empty space beside Needs attention.
   * Dense year-style compact ranges stay short strips. `self-start` keeps grid stretch
   * from overriding cell sizing.
   */
  const cellSizeClass = dense
    ? 'min-h-7 w-full'
    : compact
      ? 'h-[3rem] w-full self-start'
      : 'aspect-square h-auto w-full min-h-[4.75rem] self-start';
  /** Full calendar: pills on sm+; compact embed: pills unless range is dense (year-style). */
  const showPillLabels = !compact || !dense;
  const showWeekdayHeaders = true;
  const spanLaneCap = maxSpanLanes ?? (compact ? 1 : 2);
  const spanLaneHeightPx = dense ? 12 : compact ? 16 : 20;
  /** Overlay spanning pills inside cells — same UX for full month and mini (non-dense). */
  const useSpanOverlay = spanMode && !dense;

  const renderDayCell = (day: Date, options?: { gridCell?: boolean; overflowCount?: number }) => {
    const key = format(day, 'yyyy-MM-dd');
    const dayItems = itemsByDay.get(key) ?? [];
    const isSelected = !onDayClick && selectedDay && isSameDay(day, selectedDay);
    const isCurrentMonth = visibleRange ? true : isSameMonth(day, currentMonth);
    const hasItems = dayItems.length > 0;
    const todayFlag = isToday(day);
    const navigable = Boolean(onDayClick && hasItems);
    const gridCell = options?.gridCell ?? false;
    const overflowCount = options?.overflowCount ?? 0;

    return (
      <button
        key={key}
        type="button"
        onClick={() => {
          if (onDayClick) {
            if (hasItems) onDayClick(day, dayItems);
            return;
          }
          onSelectedDayChange(isSelected ? null : day);
        }}
        disabled={onDayClick ? !hasItems : false}
        aria-label={`${format(day, 'MMMM d, yyyy')} – ${
          hasItems
            ? `${dayItems.length} ${entityLabel}${dayItems.length === 1 ? '' : 's'}`
            : `no ${entityLabel}s`
        }`}
        aria-pressed={!onDayClick ? Boolean(isSelected) : undefined}
        className={cn(
          'relative flex flex-col outline-none transition-colors duration-150',
          gridCell
            ? cn(
                'items-stretch self-start rounded-none border-0',
                compact ? 'px-0.5 pb-0 pt-0.5' : 'px-1.5 py-1.5',
                'bg-card',
                isSelected && 'bg-sidebar-accent/50',
                !isSelected && isCurrentMonth && 'hover:bg-muted/40',
                !isCurrentMonth && 'bg-muted/20'
              )
            : cn(
                compact
                  ? 'items-center rounded-md px-0.5 py-0.5'
                  : 'items-stretch rounded-lg p-1.5',
                compact && hasItems && !todayFlag && !isSelected && 'bg-muted/35',
                isSelected && 'ring-sidebar-primary/60 bg-sidebar-accent/30 ring-2'
              ),
          cellSizeClass,
          navigable &&
            'hover:bg-muted/55 focus-visible:ring-sidebar-primary/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-inset',
          !navigable &&
            !onDayClick &&
            'focus-visible:ring-sidebar-primary/40 focus-visible:ring-2 focus-visible:ring-inset',
          onDayClick && !hasItems && 'cursor-default'
        )}
      >
        <div
          className={cn(
            'relative z-[1] flex w-full items-center justify-start gap-1',
            compact ? 'min-h-5' : 'min-h-[22px]'
          )}
        >
          <span
            className={cn(
              'font-semibold tabular-nums leading-none',
              compact ? 'text-[11px]' : 'text-[12px]',
              todayFlag
                ? cn(
                    'gradient-primary text-primary-foreground inline-flex items-center justify-center rounded-full',
                    compact ? 'size-5 text-[10px]' : 'size-6 text-[12px]'
                  )
                : isSelected && gridCell
                  ? 'text-sidebar-accent-foreground'
                  : isCurrentMonth
                    ? 'text-foreground'
                    : 'text-muted-foreground/70'
            )}
          >
            {format(day, 'd')}
          </span>
          {hasItems && !compact && !spanMode ? (
            <span
              className={cn(
                'bg-muted text-muted-foreground ml-auto inline-flex min-w-[14px] items-center justify-center',
                'rounded-full px-1 text-[9px] font-bold tabular-nums'
              )}
            >
              {dayItems.length}
            </span>
          ) : null}
          {overflowCount > 0 ? (
            <span
              className={cn(
                'bg-card text-muted-foreground ring-border ml-auto inline-flex h-5 min-w-5 items-center justify-center',
                'rounded-full px-1 text-[10px] font-bold tabular-nums ring-1',
                !hasItems && !compact && !spanMode && 'ml-auto'
              )}
              title={`${overflowCount} more ${entityLabel}${overflowCount === 1 ? '' : 's'}`}
              aria-label={`${overflowCount} more ${entityLabel}${overflowCount === 1 ? '' : 's'}`}
            >
              +{overflowCount}
            </span>
          ) : null}
        </div>

        {hasItems && showPillLabels && !spanMode && (
          <div
            className={cn(
              'mt-1.5 flex w-full flex-col gap-0.5 overflow-hidden',
              !compact && 'hidden sm:flex'
            )}
          >
            {dayItems.slice(0, compact ? 1 : 2).map((item) => (
              <div
                key={getItemKey(item)}
                onClick={
                  onItemClick
                    ? (event) => {
                        event.stopPropagation();
                        onItemClick(item);
                      }
                    : undefined
                }
                onKeyDown={
                  onItemClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onItemClick(item);
                        }
                      }
                    : undefined
                }
                role={onItemClick ? 'link' : undefined}
                tabIndex={onItemClick ? 0 : undefined}
                className={cn(onItemClick && 'cursor-pointer rounded-md')}
              >
                {renderPill(item)}
              </div>
            ))}
            {dayItems.length > (compact ? 1 : 2) && (
              <span className="text-muted-foreground mt-0.5 px-1 text-[9px] font-bold">
                +{dayItems.length - (compact ? 1 : 2)} more
              </span>
            )}
          </div>
        )}

        {hasItems && getItemStatus && (compact ? dense : true) && (
          <div
            className={cn(
              'mt-auto flex justify-center gap-0.5 pb-0.5',
              spanMode && useSpanOverlay && 'hidden',
              spanMode && !useSpanOverlay && !compact && 'sm:hidden',
              !spanMode && !compact && 'sm:hidden',
              !spanMode && compact && !dense && 'hidden'
            )}
          >
            {dayItems.slice(0, 4).map((item) => {
              const tone = statusToneStyle(getItemStatus(item));
              return (
                <span
                  key={getItemKey(item)}
                  aria-hidden
                  className={cn('size-1.5 shrink-0 rounded-full', tone.dot)}
                />
              );
            })}
          </div>
        )}
      </button>
    );
  };

  const weekdayHeader = (
    <div className="border-border/60 bg-muted/40 grid grid-cols-7 gap-px border-b">
      {CALENDAR_WEEKDAYS.map((day) => (
        <div
          key={day}
          className={cn(
            'bg-muted/30 text-muted-foreground text-center font-semibold uppercase',
            compact
              ? 'py-1 text-[9px] tracking-[0.08em]'
              : 'py-2 text-[10px] font-bold tracking-wider'
          )}
        >
          {day}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        'overflow-hidden',
        !embedded &&
          'bg-card border-border/50 rounded-xl border shadow-sm lg:col-span-2 dark:shadow-none'
      )}
    >
      {!hideNavigation ? (
        <div className="border-separator bg-muted/30 flex items-center justify-between border-b px-3 py-3 sm:px-4">
          <h2 className="text-foreground text-[14px] font-bold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-4">
            {navigationAccessory}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                aria-label="Previous month"
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
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  onMonthChange?.(today);
                  onSelectedDayChange(null);
                }}
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
                onClick={() => navigateMonth('next')}
                aria-label="Next month"
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
      ) : null}

      {spanMode ? (
        <div className={cn(compact ? 'p-1.5 sm:p-2' : 'p-2 sm:p-3')}>
          <div
            className={cn(
              'border-border/50 overflow-hidden rounded-lg border',
              compact && 'rounded-md'
            )}
          >
            {showWeekdayHeaders ? weekdayHeader : null}
            {weeks.map((week, weekIdx) => {
              const weekSegments = segmentsByWeek?.get(week.weekIndex) ?? [];
              const hasSpans = weekSegments.length > 0;
              const overflowByCol =
                hasSpans && useSpanOverlay
                  ? occupancyOverflowByCol(weekSegments, spanLaneCap)
                  : null;

              return (
                <div
                  key={week.weekIndex}
                  className={cn('border-border/60 relative', weekIdx > 0 && 'border-t')}
                >
                  <div className="bg-border/60 relative z-0 grid grid-cols-7 items-start gap-px">
                    {week.days.map((day, col) =>
                      renderDayCell(day, {
                        gridCell: true,
                        overflowCount: overflowByCol?.[col] ?? 0,
                      })
                    )}
                  </div>
                  {renderOccupancySegment && hasSpans ? (
                    useSpanOverlay ? (
                      <CalendarOccupancySpanTrack
                        segments={weekSegments}
                        getSegmentKey={(segment) =>
                          `${week.weekIndex}-${getItemKey(segment.item)}-${segment.startCol}-${segment.endCol}`
                        }
                        renderSegment={renderOccupancySegment}
                        maxLanes={spanLaneCap}
                        laneHeightPx={spanLaneHeightPx}
                        variant="overlay"
                        gapClassName="gap-px"
                        className={compact ? 'top-[1.125rem] pb-3 sm:top-5 sm:pb-3.5' : undefined}
                        hiddenClassName={compact ? undefined : 'hidden sm:flex'}
                      />
                    ) : (
                      <div className="border-border/60 bg-muted/25 dark:bg-muted/15 border-t">
                        <CalendarOccupancySpanTrack
                          segments={weekSegments}
                          getSegmentKey={(segment) =>
                            `${week.weekIndex}-${getItemKey(segment.item)}-${segment.startCol}-${segment.endCol}`
                          }
                          renderSegment={renderOccupancySegment}
                          maxLanes={spanLaneCap}
                          laneHeightPx={spanLaneHeightPx}
                          variant="stack"
                          gapClassName="gap-px"
                          className={cn(compact ? 'py-0.5' : 'py-1')}
                          hiddenClassName={cn(compact && dense && 'hidden')}
                        />
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={cn(compact ? 'p-1.5 sm:p-2' : 'p-2 sm:p-3')}>
          <div
            className={cn(
              'border-border/50 overflow-hidden rounded-lg border',
              compact && 'rounded-md'
            )}
          >
            {showWeekdayHeaders ? weekdayHeader : null}
            <div className="bg-border/60 grid grid-cols-7 items-start gap-px">
              {weeks.flatMap((week) =>
                week.days.map((day) => renderDayCell(day, { gridCell: true }))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
