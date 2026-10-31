import { useMemo, useState, type ReactNode } from 'react';

import { format } from 'date-fns';

import { buildItemsByDate } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { CalendarDayDetailPanel } from '@/features/dashboard/bookings/components/calendar/CalendarDayDetailPanel';
import { CalendarMonthGrid } from '@/features/dashboard/bookings/components/calendar/CalendarMonthGrid';

import { BookingsCalendarSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';

type Props<T> = {
  rows: T[];
  isLoading: boolean;
  error: string | null;
  isRefreshing?: boolean;
  getItemKey: (item: T) => string;
  getItemDate: (item: T) => string;
  renderPill: (item: T) => ReactNode;
  renderDayItem: (item: T) => ReactNode;
  entityLabel: string;
  entityLabelSingular?: string;
  initialMonth?: Date;
  onMonthChange?: (month: Date) => void;
  emptySelectCaption?: string;
  emptyDayCaption?: string;
};

export function DateCalendarView<T>({
  rows,
  isLoading,
  error,
  isRefreshing,
  getItemKey,
  getItemDate,
  renderPill,
  renderDayItem,
  entityLabel,
  entityLabelSingular,
  initialMonth,
  onMonthChange,
  emptySelectCaption,
  emptyDayCaption,
}: Props<T>) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const singular = entityLabelSingular ?? entityLabel.replace(/s$/, '');

  const itemsByDay = useMemo(() => buildItemsByDate(rows, getItemDate), [rows, getItemDate]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [];
    return itemsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [];
  }, [selectedDay, itemsByDay]);

  if (error) {
    return (
      <div className="border-border/50 bg-card flex flex-col items-center justify-center gap-3 rounded-xl border py-20 text-center">
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
        <BookingsCalendarSkeleton />
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
      <CalendarMonthGrid
        itemsByDay={itemsByDay}
        getItemKey={getItemKey}
        renderPill={renderPill}
        entityLabel={singular}
        initialMonth={initialMonth}
        onMonthChange={(month) => {
          onMonthChange?.(month);
          setSelectedDay(null);
        }}
        selectedDay={selectedDay}
        onSelectedDayChange={setSelectedDay}
      />

      <CalendarDayDetailPanel
        selectedDay={selectedDay}
        count={selectedDayItems.length}
        entityLabel={singular}
        emptySelectCaption={
          emptySelectCaption ?? `Click any day to see ${entityLabel} on that date`
        }
        emptyDayCaption={emptyDayCaption ?? `No ${entityLabel} on this date`}
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
