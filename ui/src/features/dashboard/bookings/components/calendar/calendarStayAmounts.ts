import { differenceInCalendarDays } from 'date-fns';

import { parseOccupancyDate } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';

/** Occupied nights for calendar math; defaults to 1 when missing/invalid. */
export function occupiedNightCount(nights: number | null | undefined): number {
  if (nights == null || !Number.isFinite(nights) || nights < 1) return 1;
  return Math.floor(nights);
}

/**
 * Occupied nights [check-in, check-out) — matches calendar cell coverage.
 * Prefers stay dates over a stale `number_of_nights` column when both are present.
 */
export function occupiedNightsFromStay(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  storedNights?: number | null | undefined
): number {
  const start = parseOccupancyDate(checkIn);
  const end = parseOccupancyDate(checkOut);
  if (start && end && end > start) {
    return Math.max(1, differenceInCalendarDays(end, start));
  }
  return occupiedNightCount(storedNights);
}

/** Parse `booking_rate` (stay total for the whole booking). */
export function stayTotalAmount(total: number | string | null | undefined): number | null {
  if (total === null || total === undefined || total === '') return null;
  const amount = typeof total === 'string' ? Number(total) : total;
  if (Number.isNaN(amount)) return null;
  return amount;
}

/** Split a stay total across occupied nights (each calendar cell is one night). */
export function amountPerOccupiedNight(
  total: number | string | null | undefined,
  nights: number | null | undefined,
  checkIn?: string | null,
  checkOut?: string | null
): number | null {
  const amount = stayTotalAmount(total);
  if (amount == null) return null;
  const nightCount =
    checkIn && checkOut
      ? occupiedNightsFromStay(checkIn, checkOut, nights)
      : occupiedNightCount(nights);
  return amount / nightCount;
}
