import { useMemo } from 'react';

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  startOfMonth,
} from 'date-fns';

import type { CalendarVisibleRange } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { statusToneStyle } from '@/features/dashboard/bookings/components/StatusBadge';

import { cn } from '@/lib/utils';

type Props<T> = {
  visibleRange: CalendarVisibleRange;
  itemsByDay: Map<string, T[]>;
  getItemKey: (item: T) => string;
  getItemStatus?: (item: T) => string;
  entityLabel: string;
  onDayClick?: (day: Date, items: T[]) => void;
};

export function CalendarYearGrid<T>({
  visibleRange,
  itemsByDay,
  getItemKey,
  getItemStatus,
  entityLabel,
  onDayClick,
}: Props<T>) {
  const months = useMemo(
    () =>
      eachMonthOfInterval({
        start: visibleRange.from,
        end: visibleRange.to,
      }),
    [visibleRange.from, visibleRange.to]
  );

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {months.map((month) => (
        <MiniMonth
          key={format(month, 'yyyy-MM')}
          month={month}
          itemsByDay={itemsByDay}
          getItemKey={getItemKey}
          getItemStatus={getItemStatus}
          entityLabel={entityLabel}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}

function MiniMonth<T>({
  month,
  itemsByDay,
  getItemKey,
  getItemStatus,
  entityLabel,
  onDayClick,
}: {
  month: Date;
  itemsByDay: Map<string, T[]>;
  getItemKey: (item: T) => string;
  getItemStatus?: (item: T) => string;
  entityLabel: string;
  onDayClick?: (day: Date, items: T[]) => void;
}) {
  const { days, paddingStart } = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return {
      days: eachDayOfInterval({ start, end }),
      paddingStart: getDay(start),
    };
  }, [month]);

  return (
    <div className="border-border/40 bg-muted/20 min-w-0 rounded-lg border p-1.5 sm:p-2">
      <p className="text-muted-foreground mb-1 text-[10px] font-bold uppercase tracking-wide">
        {format(month, 'MMM yyyy')}
      </p>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: paddingStart }).map((_, idx) => (
          <div key={`pad-${idx}`} className="aspect-square min-h-[22px]" />
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayItems = itemsByDay.get(key) ?? [];
          const hasItems = dayItems.length > 0;
          const todayFlag = isToday(day);
          const navigable = Boolean(onDayClick && hasItems);

          return (
            <button
              key={key}
              type="button"
              disabled={onDayClick ? !hasItems : false}
              onClick={() => {
                if (onDayClick && hasItems) onDayClick(day, dayItems);
              }}
              aria-label={`${format(day, 'MMMM d, yyyy')} – ${
                hasItems ? `${dayItems.length} ${entityLabel}` : `no ${entityLabel}s`
              }`}
              className={cn(
                'relative flex aspect-square min-h-[22px] flex-col items-center justify-center rounded p-0.5 outline-none',
                navigable &&
                  'hover:bg-muted/60 focus-visible:ring-sidebar-primary/40 cursor-pointer focus-visible:ring-1',
                onDayClick && !hasItems && 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'text-[9px] font-semibold leading-none',
                  todayFlag
                    ? 'gradient-primary text-primary-foreground inline-flex size-4 items-center justify-center rounded-full'
                    : 'text-foreground/80'
                )}
              >
                {format(day, 'd')}
              </span>
              {hasItems && getItemStatus ? (
                <span className="mt-0.5 flex max-w-full justify-center gap-px">
                  {dayItems.slice(0, 3).map((item) => {
                    const tone = statusToneStyle(getItemStatus(item));
                    return (
                      <span
                        key={getItemKey(item)}
                        aria-hidden
                        className={cn('size-1 shrink-0 rounded-full', tone.dot)}
                      />
                    );
                  })}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
