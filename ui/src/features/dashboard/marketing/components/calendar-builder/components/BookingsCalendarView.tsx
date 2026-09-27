import { useMemo, useState } from 'react';

import { Link, useParams } from 'react-router-dom';

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
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';

import {
  buildCalendarWeekRows,
  buildOccupancyByDay,
  buildOccupancySegmentsForWeeks,
  calendarOccupancySpanPosition,
  calendarPaddingStart,
} from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { CalendarOccupancySpanTrack } from '@/features/dashboard/bookings/components/calendar/CalendarOccupancySpanTrack';
import { bookingDetailPath } from '@/features/dashboard/org/lib/tenantPaths';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { CalendarBooking } from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Short labels and badge variants for calendar cells and detail panel */
const STATUS_DISPLAY: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING_REVIEW: { label: 'Review', variant: 'destructive' },
  PENDING_GAF: { label: 'GAF', variant: 'secondary' },
  PENDING_PARKING: { label: 'Parking', variant: 'secondary' },
  PENDING_PET_REQUEST: { label: 'Pet', variant: 'secondary' },
  READY_FOR_CHECKIN: { label: 'Ready', variant: 'default' },
  CHECKED_IN: { label: 'Checked in', variant: 'default' },
  PENDING_SD_REFUND: { label: 'Checkout', variant: 'destructive' },
  COMPLETED: { label: 'Completed', variant: 'outline' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusDisplay(status: string) {
  return STATUS_DISPLAY[status] ?? { label: status, variant: 'secondary' as const };
}

function MarketingBookingSpanPill({
  booking,
  showLabel,
  spanPosition,
}: {
  booking: CalendarBooking;
  showLabel: boolean;
  spanPosition: ReturnType<typeof calendarOccupancySpanPosition>;
}) {
  const statusDisplay = getStatusDisplay(booking.status);
  const roundedClass =
    spanPosition === 'start'
      ? 'rounded-l-md rounded-r-none'
      : spanPosition === 'end'
        ? 'rounded-r-md rounded-l-none'
        : spanPosition === 'middle'
          ? 'rounded-none'
          : 'rounded-md';

  return (
    <div
      className={cn(
        'bg-muted/60 border-border flex h-full min-w-0 items-center gap-1 truncate border px-1 py-0.5',
        roundedClass
      )}
      title={booking.guestName}
    >
      {showLabel ? (
        <>
          <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden />
          <span className="text-foreground truncate text-[10px] font-medium">
            {booking.guestName}
          </span>
          <Badge
            variant={statusDisplay.variant}
            className="ml-auto h-4 shrink-0 truncate px-1 text-[8px] font-medium"
          >
            {statusDisplay.label}
          </Badge>
        </>
      ) : (
        <span aria-hidden className="bg-primary/30 block min-h-[10px] w-full rounded-sm" />
      )}
    </div>
  );
}

interface BookingsCalendarViewProps {
  bookings: CalendarBooking[];
  propertySlug: string;
}

export function BookingsCalendarView({ bookings, propertySlug }: BookingsCalendarViewProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const itemsByDay = useMemo(
    () =>
      buildOccupancyByDay(
        bookings,
        (booking) => booking.checkIn,
        (booking) => booking.checkOut
      ),
    [bookings]
  );

  const calendarGrid = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    return { days, paddingStart: calendarPaddingStart(start, 1) };
  }, [currentMonth]);

  const weeks = useMemo(
    () => buildCalendarWeekRows(calendarGrid.days, calendarGrid.paddingStart),
    [calendarGrid.days, calendarGrid.paddingStart]
  );

  const segmentsByWeek = useMemo(
    () =>
      buildOccupancySegmentsForWeeks(
        bookings,
        weeks,
        (booking) => booking.checkIn,
        (booking) => booking.checkOut
      ),
    [bookings, weeks]
  );

  const selectedDayBooking = useMemo((): CalendarBooking | null => {
    if (!selectedDay) return null;
    const key = format(selectedDay, 'yyyy-MM-dd');
    return itemsByDay.get(key)?.[0] ?? null;
  }, [selectedDay, itemsByDay]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((current) =>
      direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1)
    );
    setSelectedDay(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="bg-card border-border lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-foreground">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateMonth('prev')}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateMonth('next')}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-muted-foreground py-2 text-center text-xs font-medium">
                {day}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {weeks.map((week) => (
              <div key={week.weekIndex}>
                <div className="grid grid-cols-7 gap-1">
                  {week.days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDay(isSelected ? null : day)}
                        className={cn(
                          'relative flex aspect-square flex-col items-center justify-start rounded-lg p-1 transition-all',
                          'hover:bg-muted/50',
                          isSelected && 'ring-primary bg-primary/10 ring-2',
                          !isCurrentMonth && 'opacity-30',
                          isToday(day) && 'font-bold'
                        )}
                      >
                        <span
                          className={cn(
                            'text-sm',
                            isToday(day) &&
                              'bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <CalendarOccupancySpanTrack
                  segments={segmentsByWeek.get(week.weekIndex) ?? []}
                  getSegmentKey={(segment) =>
                    `${week.weekIndex}-${segment.item.id}-${segment.startCol}-${segment.endCol}`
                  }
                  renderSegment={(segment) => (
                    <MarketingBookingSpanPill
                      booking={segment.item}
                      showLabel={segment.showLabel}
                      spanPosition={calendarOccupancySpanPosition(segment)}
                    />
                  )}
                  maxLanes={2}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {selectedDay ? format(selectedDay, 'MMMM d, yyyy') : 'Select a day'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDay ? (
            selectedDayBooking ? (
              <div className="flex flex-col gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground font-semibold">{selectedDayBooking.guestName}</p>
                    <Badge variant={getStatusDisplay(selectedDayBooking.status).variant}>
                      {getStatusDisplay(selectedDayBooking.status).label}
                    </Badge>
                  </div>
                  <dl className="text-muted-foreground grid gap-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt>Booking</dt>
                      <dd className="text-foreground font-medium">
                        {selectedDayBooking.bookingNumber}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Check-in</dt>
                      <dd>{format(new Date(selectedDayBooking.checkIn), 'MMM d, yyyy')}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Check-out</dt>
                      <dd>{format(new Date(selectedDayBooking.checkOut), 'MMM d, yyyy')}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Nights</dt>
                      <dd>
                        {selectedDayBooking.nights}{' '}
                        {selectedDayBooking.nights === 1 ? 'night' : 'nights'}
                      </dd>
                    </div>
                    <div className="border-border flex justify-between gap-2 border-t pt-2">
                      <dt>Amount</dt>
                      <dd className="text-foreground font-semibold">
                        {formatCurrency(selectedDayBooking.amount)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <Button asChild variant="default" className="w-full gap-2">
                  <Link
                    to={
                      orgSlug
                        ? bookingDetailPath(orgSlug, propertySlug, selectedDayBooking.id)
                        : '#'
                    }
                  >
                    View booking
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarCheck className="text-muted-foreground/50 mb-2 h-10 w-10" />
                <p className="text-muted-foreground text-sm font-medium">No booking</p>
                <p className="text-muted-foreground text-xs">There is no booking on this day</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarCheck className="text-muted-foreground/50 mb-2 h-10 w-10" />
              <p className="text-muted-foreground text-sm font-medium">Click on a day</p>
              <p className="text-muted-foreground text-xs">
                Select a day to see complete booking details
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
