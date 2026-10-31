import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useNavigate } from 'react-router-dom';

import { bookingResourceName } from '@/features/dashboard/bookings/components/BookingResourceLabel';
import type { BookingCalendarPillLabelMode } from '@/features/dashboard/bookings/components/calendar/BookingCalendarPillLabelToggle';
import { calendarOccupancySpanPosition } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { CalendarDayBookingCard } from '@/features/dashboard/bookings/components/calendar/CalendarDayBookingCard';
import { CalendarPeriodToggle } from '@/features/dashboard/bookings/components/calendar/CalendarPeriodToggle';
import {
  amountPerOccupiedNight,
  stayTotalAmount,
} from '@/features/dashboard/bookings/components/calendar/calendarStayAmounts';
import { CalendarTimeGrid } from '@/features/dashboard/bookings/components/calendar/CalendarTimeGrid';
import type { CalendarPeriod } from '@/features/dashboard/bookings/components/calendar/calendarTimeGridUtils';
import {
  CalendarOccupancyPill,
  OccupancyCalendarView,
} from '@/features/dashboard/bookings/components/calendar/OccupancyCalendarView';
import { bookingListDisplayName } from '@/features/dashboard/bookings/lib/bookingListDisplay';
import { statusLabel, statusTone } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DatePreset } from '@/lib/date/navigation';
import { fromIsoDate } from '@/lib/date/navigation';
import { STATUS_TONE_CALENDAR_BLOCK } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';
import { formatStayDateRange } from '@/utils/format/dates';

type Props = {
  rows: BookingRow[];
  isLoading: boolean;
  error: string | null;
  isRefreshing?: boolean;
  initialMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Compact grid without day-detail sidebar; day/pill clicks open booking detail. */
  variant?: 'full' | 'mini';
  /** ISO bounds from dashboard date filter (mini only). */
  rangeFrom?: string;
  rangeTo?: string;
  datePreset?: DatePreset;
  /** Mini calendar day pills: guest first name or booking rate. */
  pillLabelMode?: BookingCalendarPillLabelMode;
  /** Optional control beside month nav (e.g. Name/Price toggle). */
  navigationAccessory?: ReactNode;
  showProperty?: boolean;
  resolveBookingHref?: (row: BookingRow) => string;
};

function bookingPillLabel(row: BookingRow): string {
  return row.primary_guest_name?.split(' ')[0] || row.guest_facebook_name?.split(' ')[0] || 'Guest';
}

/** Price mode shows the full stay total (sum of nights), not the per-night split. */
function bookingPillPriceLabel(row: BookingRow): string {
  const stayTotal = stayTotalAmount(row.booking_rate);
  if (stayTotal == null) return '-';
  return formatMoneyCompact(stayTotal);
}

function bookingPillTitle(row: BookingRow, resourceSuffix: string): string {
  const guestName = bookingListDisplayName(row);
  const stayTotal = stayTotalAmount(row.booking_rate);
  const perNight = amountPerOccupiedNight(
    row.booking_rate,
    row.number_of_nights,
    row.check_in_date,
    row.check_out_date
  );
  const stayPart =
    stayTotal == null
      ? '-'
      : perNight == null
        ? formatMoneyCompact(stayTotal)
        : `${formatMoneyCompact(stayTotal)} stay (${formatMoneyCompact(perNight)}/night)`;
  return `${guestName}${resourceSuffix} · ${stayPart} · ${statusLabel(row.status)}`;
}

/** Pricing-calendar–style hover card for week/day stay blocks. */
function BookingCalendarStayTooltip({
  row,
  showProperty,
}: {
  row: BookingRow;
  showProperty?: boolean;
}) {
  const range = formatStayDateRange(row.check_in_date, row.check_out_date);
  const stayTotal = stayTotalAmount(row.booking_rate);
  const resource = showProperty ? bookingResourceName(row) : null;

  return (
    <div className="min-w-[9.5rem] space-y-1.5">
      <p className="text-foreground text-sm font-semibold leading-none">
        {bookingListDisplayName(row)}
      </p>
      {resource ? (
        <p className="text-muted-foreground text-xs font-medium leading-none">{resource}</p>
      ) : null}
      {range ? (
        <p className="text-muted-foreground text-xs font-medium leading-none">{range}</p>
      ) : null}
      {stayTotal != null ? (
        <p className="text-foreground text-base font-semibold tabular-nums leading-none">
          {formatMoneyCompact(stayTotal)}
        </p>
      ) : null}
      <div className="border-border/60 border-t pt-2">
        <span className="bg-muted/80 text-muted-foreground inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none">
          {statusLabel(row.status)}
        </span>
      </div>
    </div>
  );
}

export function BookingCalendarView({
  rows,
  isLoading,
  error,
  isRefreshing,
  initialMonth,
  onMonthChange,
  variant = 'full',
  rangeFrom,
  rangeTo,
  datePreset,
  pillLabelMode = 'name',
  navigationAccessory,
  showProperty = false,
  resolveBookingHref,
}: Props) {
  const navigate = useNavigate();
  const mini = variant === 'mini';
  const [period, setPeriod] = useState<CalendarPeriod>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => initialMonth ?? new Date());
  const [highlightedStayId, setHighlightedStayId] = useState<string | null>(null);

  useEffect(() => {
    if (initialMonth) setAnchorDate(initialMonth);
  }, [initialMonth]);

  const visibleRange = useMemo(() => {
    if (!mini || !rangeFrom || !rangeTo) return undefined;
    const from = fromIsoDate(rangeFrom);
    const to = fromIsoDate(rangeTo);
    if (!from || !to) return undefined;
    return { from, to };
  }, [mini, rangeFrom, rangeTo]);

  const openBooking = useCallback(
    (row: BookingRow) => {
      navigate(resolveBookingHref ? resolveBookingHref(row) : `/bookings/${row.id}`);
    },
    [navigate, resolveBookingHref]
  );

  const handleDayClick = useCallback(
    (_day: Date, items: BookingRow[]) => {
      if (items.length === 0) return;
      openBooking(items[0]);
    },
    [openBooking]
  );

  const handleAnchorDateChange = useCallback(
    (next: Date) => {
      setAnchorDate(next);
      onMonthChange?.(next);
    },
    [onMonthChange]
  );

  const handlePeriodChange = useCallback((next: CalendarPeriod) => {
    setPeriod(next);
  }, []);

  const periodToggle = !mini ? (
    <CalendarPeriodToggle value={period} onChange={handlePeriodChange} />
  ) : null;

  const combinedAccessory =
    periodToggle || navigationAccessory ? (
      <div className="flex flex-wrap items-center gap-2">
        {periodToggle}
        {navigationAccessory}
      </div>
    ) : null;

  if (!mini && (period === 'week' || period === 'day')) {
    if (error) {
      return (
        <div className="bg-card border-border/50 flex flex-col items-center justify-center gap-3 rounded-xl border py-20 text-center">
          <div className="flex size-9 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/15">
            <span className="text-base font-black leading-none text-red-500">!</span>
          </div>
          <div>
            <p className="text-foreground text-[14px] font-bold">Could not load bookings</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-[12px]">{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className={cn('min-w-0 transition-opacity duration-300', isRefreshing && 'opacity-60')}>
        <CalendarTimeGrid
          period={period}
          rows={isLoading ? [] : rows}
          anchorDate={anchorDate}
          onAnchorDateChange={handleAnchorDateChange}
          getItemKey={(row) => row.id}
          getItemStatus={(row) => row.status}
          getCheckIn={(row) => row.check_in_date}
          getCheckOut={(row) => row.check_out_date}
          getCheckInTime={(row) => row.check_in_time}
          getCheckOutTime={(row) => row.check_out_time}
          renderBlockLabel={(row) => {
            const priceLabel = bookingPillPriceLabel(row);
            return pillLabelMode === 'price' ? priceLabel : bookingPillLabel(row);
          }}
          renderBlockTitle={(row) => {
            const resourceSuffix =
              showProperty && bookingResourceName(row) ? ` · ${bookingResourceName(row)}` : '';
            return bookingPillTitle(row, resourceSuffix);
          }}
          renderTooltipContent={(row) => (
            <BookingCalendarStayTooltip row={row} showProperty={showProperty} />
          )}
          onItemClick={openBooking}
          navigationAccessory={combinedAccessory}
          onRequestDayView={(day) => {
            setAnchorDate(day);
            setPeriod('day');
            onMonthChange?.(day);
          }}
        />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <OccupancyCalendarView
        rows={rows}
        isLoading={isLoading}
        error={error}
        isRefreshing={isRefreshing}
        getItemKey={(row) => row.id}
        getItemStatus={(row) => row.status}
        renderPill={(row) => {
          const priceLabel = bookingPillPriceLabel(row);
          const label = pillLabelMode === 'price' ? priceLabel : bookingPillLabel(row);
          const resourceSuffix =
            showProperty && bookingResourceName(row) ? ` · ${bookingResourceName(row)}` : '';

          return (
            <CalendarOccupancyPill
              status={row.status}
              label={label}
              compact={mini}
              title={bookingPillTitle(row, resourceSuffix)}
              labelClassName={pillLabelMode === 'price' ? 'tabular-nums' : undefined}
            />
          );
        }}
        renderOccupancySegment={(segment) => {
          const row = segment.item;
          const priceLabel = bookingPillPriceLabel(row);
          const label = pillLabelMode === 'price' ? priceLabel : bookingPillLabel(row);
          const resourceSuffix =
            showProperty && bookingResourceName(row) ? ` · ${bookingResourceName(row)}` : '';
          const title = bookingPillTitle(row, resourceSuffix);
          const spanPosition = calendarOccupancySpanPosition(segment);
          const isHighlighted = highlightedStayId === row.id;
          const blockTone = STATUS_TONE_CALENDAR_BLOCK[statusTone(row.status)];

          const pill = (
            <CalendarOccupancyPill
              status={row.status}
              label={label}
              compact={mini}
              showLabel={segment.showLabel}
              spanPosition={spanPosition}
              labelClassName={pillLabelMode === 'price' ? 'tabular-nums' : undefined}
              className={cn(
                'motion-safe:transition-colors motion-safe:duration-150',
                isHighlighted && cn(blockTone.hover, 'z-[1]')
              )}
            />
          );

          return (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openBooking(row);
                  }}
                  onMouseEnter={() => setHighlightedStayId(row.id)}
                  onMouseLeave={() => setHighlightedStayId(null)}
                  onFocus={() => setHighlightedStayId(row.id)}
                  onBlur={() => setHighlightedStayId(null)}
                  className="h-full w-full min-w-0 cursor-pointer text-left outline-none focus-visible:outline-none"
                  aria-label={`Open booking for ${title}`}
                >
                  {pill}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="px-3 py-2.5">
                <BookingCalendarStayTooltip row={row} showProperty={showProperty} />
              </TooltipContent>
            </Tooltip>
          );
        }}
        renderDayItem={(row) => (
          <CalendarDayBookingCard
            row={row}
            amount={{ mode: 'booking_rate', amount: row.booking_rate }}
            showProperty={showProperty}
            onOpen={() => openBooking(row)}
          />
        )}
        entityLabel="bookings"
        entityLabelSingular="booking"
        initialMonth={initialMonth}
        onMonthChange={(month) => {
          setAnchorDate(month);
          onMonthChange?.(month);
        }}
        emptySelectCaption="Click any day to see bookings with a stay that night"
        emptyDayCaption="No guest stays are scheduled for this night"
        layout={mini ? 'grid-only' : 'full'}
        compact={mini}
        embedded={mini}
        onDayClick={mini ? handleDayClick : undefined}
        onItemClick={openBooking}
        visibleRange={visibleRange}
        datePreset={datePreset}
        hideNavigation={mini && Boolean(visibleRange)}
        navigationAccessory={combinedAccessory}
      />
    </TooltipProvider>
  );
}
