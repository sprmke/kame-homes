import { addDays, endOfMonth, startOfDay, startOfMonth } from 'date-fns';

import type { PreviewBooking } from '@/features/dashboard/marketing/components/calendar-builder/types';

import { normalizeDateString, stringToDate, type BookedDateRange } from '@/utils/format/dates';

/** Occupied nights: check-in inclusive, check-out exclusive (matches guest calendar). */
function occupiedNightRange(checkIn: Date, checkOut: Date): { start: Date; end: Date } | null {
  const start = startOfDay(checkIn);
  const lastNight = addDays(startOfDay(checkOut), -1);
  if (lastNight < start) return null;
  return { start, end: lastNight };
}

/** Convert API booked ranges + preview month into CalendarPreview day-of-month bookings. */
export function bookedDatesToPreviewBookings(
  ranges: BookedDateRange[],
  previewMonth: Date
): PreviewBooking[] {
  const monthStart = startOfMonth(previewMonth);
  const monthEnd = endOfMonth(previewMonth);

  const bookings: PreviewBooking[] = [];

  for (const range of ranges) {
    const checkIn = stringToDate(normalizeDateString(range.checkInDate));
    const checkOut = stringToDate(normalizeDateString(range.checkOutDate));
    const occupied = occupiedNightRange(checkIn, checkOut);
    if (!occupied) continue;

    if (occupied.end < monthStart || occupied.start > monthEnd) continue;

    const clipStart = occupied.start < monthStart ? monthStart : occupied.start;
    const clipEnd = occupied.end > monthEnd ? monthEnd : occupied.end;

    bookings.push({
      id: range.id,
      guestName: 'Booked',
      startDay: clipStart.getDate(),
      endDay: clipEnd.getDate(),
      status: 'confirmed',
    });
  }

  return bookings.sort((a, b) => a.startDay - b.startDay);
}

/** Short availability line for design/video templates. */
export function availabilityTextForMonth(ranges: BookedDateRange[], previewMonth: Date): string {
  const daysInMonth = endOfMonth(previewMonth).getDate();
  const bookings = bookedDatesToPreviewBookings(ranges, previewMonth);
  const bookedDays = new Set<number>();

  for (const booking of bookings) {
    for (let d = booking.startDay; d <= booking.endDay; d++) {
      bookedDays.add(d);
    }
  }

  const available = daysInMonth - bookedDays.size;
  if (available <= 0) return 'Fully booked this month';
  if (available === daysInMonth) return 'Open all month';
  return `${available} nights available`;
}

export type OpenSlotLabel = { dateNum: string; dayName: string };

/** Next available calendar days in a month for slot-style templates. */
export function openSlotDatesForMonth(
  ranges: BookedDateRange[],
  previewMonth: Date,
  count: number
): OpenSlotLabel[] {
  const daysInMonth = endOfMonth(previewMonth).getDate();
  const bookings = bookedDatesToPreviewBookings(ranges, previewMonth);
  const bookedDays = new Set<number>();

  for (const booking of bookings) {
    for (let d = booking.startDay; d <= booking.endDay; d++) {
      bookedDays.add(d);
    }
  }

  const open: OpenSlotLabel[] = [];
  for (let day = 1; day <= daysInMonth && open.length < count; day++) {
    if (bookedDays.has(day)) continue;
    const date = new Date(previewMonth.getFullYear(), previewMonth.getMonth(), day);
    open.push({
      dateNum: String(day),
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
    });
  }

  while (open.length < count) {
    open.push({ dateNum: '-', dayName: 'OPEN' });
  }

  return open.slice(0, count);
}
