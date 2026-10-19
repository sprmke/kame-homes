import { useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  clampGuestCalendarCheckoutHover,
  hasBlockedNightBetween,
  isGuestCalendarCheckInBlocked,
  isGuestCalendarDateDisabled,
  isGuestCalendarValidCheckoutDate,
} from '@/features/guest/calendar/lib/guestCalendarAvailability';
import { useGuestBookedDates } from '@/features/guest/form/hooks/useGuestBookedDates';
import { usePropertyReserve } from '@/features/guest/marketing/properties/hooks/usePropertyReserve';
import { GuestStayDateRangeDisplay } from '@/features/guest/property/components/GuestStayDateRangeDisplay';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

type DayState = 'available' | 'booked' | 'today' | 'checkIn' | 'checkOut' | 'inRange' | 'past';

export interface PublicPropertyCalendarProps {
  propertyName: string;
  propertySlug: string;
  isCustom?: boolean;
  initialMonth?: Date;
  /** Controlled mode: externally managed check-in/check-out dates */
  value?: { checkIn: Date | null; checkOut: Date | null };
  /** Fires whenever check-in or check-out changes in controlled mode */
  onDatesChange?: (checkIn: Date | null, checkOut: Date | null) => void;
  /** Hide the "Book Now" link/action area (e.g. when embedded inside BookingCard modal) */
  showBookingAction?: boolean;
  /** Hide built-in date summary (e.g. when the page renders GuestStayContextBar) */
  showDateSummary?: boolean;
  /** Reduce internal padding for embedding inside dialogs */
  compact?: boolean;
  /** Plain layout without card chrome — for operational pages inside MainLayout */
  embedded?: boolean;
  className?: string;
}

function toMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function PublicPropertyCalendar({
  propertySlug,
  isCustom = false,
  initialMonth,
  value,
  onDatesChange,
  showBookingAction = true,
  showDateSummary = true,
  compact = false,
  embedded = false,
  className,
}: PublicPropertyCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth ?? new Date());
  const [internalCheckIn, setInternalCheckIn] = useState<Date | null>(null);
  const [internalCheckOut, setInternalCheckOut] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const { data: bookedDates = [], isLoading, isError } = useGuestBookedDates(propertySlug);

  const isControlled = value !== undefined;
  const checkIn = isControlled ? (value?.checkIn ?? null) : internalCheckIn;
  const checkOut = isControlled ? (value?.checkOut ?? null) : internalCheckOut;

  const setDates = (newCheckIn: Date | null, newCheckOut: Date | null) => {
    if (isControlled) {
      onDatesChange?.(newCheckIn, newCheckOut);
    } else {
      setInternalCheckIn(newCheckIn);
      setInternalCheckOut(newCheckOut);
    }
  };

  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { year, month, monthName: MONTH_NAMES[month]!, daysInMonth, firstDay };
  }, [currentMonth]);

  const today = useMemo(() => toMidnight(new Date()), []);

  const effectiveHoverDate = useMemo(() => {
    if (!checkIn || !hoverDate || checkOut) return null;
    const ci = toMidnight(checkIn);
    const hd = toMidnight(hoverDate);
    if (hd <= ci) return null;
    return clampGuestCalendarCheckoutHover(bookedDates, ci, hd, today);
  }, [bookedDates, checkIn, hoverDate, checkOut, today]);

  const getDayState = (day: number): DayState => {
    const cellDate = toMidnight(new Date(calendarData.year, calendarData.month, day));
    const selectingCheckout = Boolean(checkIn && !checkOut);

    if (cellDate < today) return 'past';

    if (checkIn) {
      const ci = toMidnight(checkIn);
      if (cellDate.getTime() === ci.getTime()) return 'checkIn';

      if (checkOut) {
        const co = toMidnight(checkOut);
        if (cellDate.getTime() === co.getTime()) return 'checkOut';
        if (cellDate > ci && cellDate < co) return 'inRange';
      } else if (effectiveHoverDate) {
        const ehd = toMidnight(effectiveHoverDate);
        if (ehd > ci && cellDate > ci && cellDate < ehd) return 'inRange';
      }

      if (
        selectingCheckout &&
        isGuestCalendarValidCheckoutDate(bookedDates, cellDate, checkIn, today)
      ) {
        if (cellDate.getTime() === today.getTime()) return 'today';
        return 'available';
      }
    }

    if (isGuestCalendarCheckInBlocked(bookedDates, cellDate)) return 'booked';
    if (cellDate.getTime() === today.getTime()) return 'today';

    return 'available';
  };

  const isDaySelectable = (day: number): boolean => {
    if (isLoading) return false;
    const cellDate = toMidnight(new Date(calendarData.year, calendarData.month, day));
    return !isGuestCalendarDateDisabled(bookedDates, cellDate, checkIn, checkOut, today);
  };

  const handleDayClick = (day: number) => {
    if (!isDaySelectable(day)) return;

    const clickedDate = toMidnight(new Date(calendarData.year, calendarData.month, day));

    if (!checkIn || checkOut) {
      setDates(clickedDate, null);
    } else {
      const ci = toMidnight(checkIn);
      if (clickedDate <= ci) {
        setDates(clickedDate, null);
      } else if (hasBlockedNightBetween(bookedDates, ci, clickedDate)) {
        setDates(clickedDate, null);
      } else {
        setDates(checkIn, clickedDate);
      }
    }
    setHoverDate(null);
  };

  const handleDayMouseEnter = (day: number) => {
    if (checkIn && !checkOut && !isLoading) {
      setHoverDate(new Date(calendarData.year, calendarData.month, day));
    }
  };

  const prevMonth = () =>
    setCurrentMonth((p) => {
      const d = new Date(p);
      d.setMonth(d.getMonth() - 1);
      return d;
    });

  const nextMonth = () =>
    setCurrentMonth((p) => {
      const d = new Date(p);
      d.setMonth(d.getMonth() + 1);
      return d;
    });

  const clearSelection = () => {
    setDates(null, null);
    setHoverDate(null);
  };

  const { reserve } = usePropertyReserve({
    propertySlug,
    checkIn,
    checkOut,
  });

  const cells: Array<{ day: number | null }> = [
    ...Array.from({ length: calendarData.firstDay }, () => ({ day: null })),
    ...Array.from({ length: calendarData.daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];

  const showFooter = !compact && showDateSummary;

  const emptyCellClass = cn(
    compact && 'aspect-square max-h-14',
    embedded && 'aspect-square w-full',
    !compact && !embedded && 'aspect-square'
  );

  const dayCellClass = cn(
    'relative select-none font-medium transition-all duration-100',
    compact && 'aspect-square max-h-14 w-full rounded-xl text-sm',
    embedded && 'aspect-square w-full rounded-xl text-sm',
    !compact && !embedded && 'aspect-square rounded-xl text-sm'
  );

  return (
    <div
      className={cn(
        'w-full',
        isCustom
          ? 'max-w-[900px] rounded-3xl p-7 sm:p-10'
          : compact
            ? 'max-w-[900px] rounded-none bg-transparent p-0'
            : embedded
              ? 'w-full bg-transparent p-0'
              : 'border-border bg-card max-w-[900px] rounded-2xl border p-6 shadow-[0_4px_40px_-12px_rgba(0,0,0,0.12)] sm:p-8',
        className
      )}
      style={
        isCustom ? { background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 100%)' } : undefined
      }
    >
      <div
        className={cn(
          'flex items-center justify-between',
          compact ? 'mb-3' : embedded ? 'mb-4' : 'mb-7'
        )}
      >
        <h2
          className={cn(
            'font-bold tracking-tight',
            compact ? 'text-base sm:text-lg' : embedded ? 'text-lg' : 'text-xl sm:text-2xl',
            isCustom ? 'text-green-900' : 'text-foreground'
          )}
        >
          {calendarData.monthName} {calendarData.year}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className={cn(
              'flex h-9 min-h-[44px] w-9 min-w-[44px] items-center justify-center transition-colors sm:min-h-9 sm:min-w-9',
              compact ? 'rounded-full' : 'rounded-xl',
              isCustom
                ? 'bg-white/80 text-green-700 hover:bg-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className={cn(
              'flex h-9 min-h-[44px] w-9 min-w-[44px] items-center justify-center transition-colors sm:min-h-9 sm:min-w-9',
              compact ? 'rounded-full' : 'rounded-xl',
              isCustom
                ? 'bg-white/80 text-green-700 hover:bg-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className={cn(
              'py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider',
              isCustom ? 'text-green-700' : 'text-muted-foreground'
            )}
          >
            {name}
          </div>
        ))}
      </div>

      <div
        className={cn('grid grid-cols-7', compact ? 'gap-0.5' : embedded ? 'gap-1.5' : 'gap-1')}
        onMouseLeave={() => setHoverDate(null)}
        aria-busy={isLoading}
      >
        {cells.map((cell, index) => {
          if (!cell.day) {
            return <div key={`empty-${index}`} className={emptyCellClass} />;
          }

          if (isLoading) {
            return <Skeleton key={`loading-${cell.day}`} className={dayCellClass} />;
          }

          const state = getDayState(cell.day);
          const isSelectable = isDaySelectable(cell.day);

          return (
            <button
              key={cell.day}
              onClick={() => handleDayClick(cell.day!)}
              onMouseEnter={() => handleDayMouseEnter(cell.day!)}
              disabled={!isSelectable}
              aria-label={`${calendarData.monthName} ${cell.day}, ${state === 'booked' ? 'booked' : state === 'past' ? 'unavailable' : 'available'}`}
              aria-pressed={state === 'checkIn' || state === 'checkOut'}
              className={cn(
                dayCellClass,
                !isCustom &&
                  state === 'available' &&
                  'text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer',
                !isCustom && state === 'past' && 'text-muted-foreground/30 cursor-not-allowed',
                !isCustom &&
                  state === 'booked' &&
                  'bg-muted/30 text-muted-foreground/30 decoration-muted-foreground/30 cursor-not-allowed line-through',
                !isCustom &&
                  state === 'today' &&
                  'text-primary ring-primary cursor-pointer font-bold ring-2',
                !isCustom &&
                  (state === 'checkIn' || state === 'checkOut') &&
                  'bg-primary-strong text-primary-foreground cursor-pointer font-semibold shadow-sm',
                !isCustom &&
                  state === 'inRange' &&
                  'bg-primary/10 text-primary cursor-pointer rounded-xl',
                isCustom &&
                  state === 'available' &&
                  'cursor-pointer text-green-900 hover:bg-white/60',
                isCustom && state === 'past' && 'cursor-not-allowed text-green-900/20',
                isCustom &&
                  state === 'booked' &&
                  'cursor-not-allowed bg-green-600/20 text-green-900/30 line-through decoration-green-900/20',
                isCustom &&
                  state === 'today' &&
                  'cursor-pointer font-bold text-green-900 ring-2 ring-green-600',
                isCustom &&
                  (state === 'checkIn' || state === 'checkOut') &&
                  'cursor-pointer bg-green-600 font-semibold text-white shadow-sm',
                isCustom &&
                  state === 'inRange' &&
                  'cursor-pointer rounded-xl bg-white/40 text-green-900'
              )}
            >
              {cell.day}

              {state === 'today' && (
                <span
                  className={cn(
                    'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                    isCustom ? 'bg-green-600' : 'bg-primary'
                  )}
                />
              )}

              {isCustom && state === 'booked' && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg"
                >
                  🔑
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isError ? (
        <p className="text-destructive mt-3 text-center text-xs">
          Could not load availability. Try again in a moment.
        </p>
      ) : null}

      {showFooter && checkIn ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
          <GuestStayDateRangeDisplay
            checkIn={checkIn}
            checkOut={checkOut}
            onClear={clearSelection}
            tone={isCustom ? 'success' : 'brand'}
            className="min-w-0 flex-1"
          />
          {showBookingAction && checkOut ? (
            <Button
              type="button"
              size="sm"
              onClick={reserve}
              disabled={isLoading}
              className={cn(
                'min-h-[44px] w-full shrink-0 rounded-full px-5 text-white sm:w-auto sm:self-center',
                isCustom
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-primary-strong text-primary-foreground hover:bg-primary-strong/90'
              )}
            >
              Book Now
            </Button>
          ) : null}
        </div>
      ) : showFooter ? (
        <p
          className={cn(
            'mt-4 text-center text-xs',
            isCustom ? 'text-green-600' : 'text-muted-foreground'
          )}
        >
          Select your check-in date to begin booking
        </p>
      ) : null}
    </div>
  );
}
