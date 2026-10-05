/**
 * Batch availability helpers for public search / listing endpoints.
 *
 * Overlap model (half-open, checkout-exclusive):
 *   existing.checkIn < requested.checkOut && existing.checkOut > requested.checkIn
 *
 * Date strings on guest_submissions may be MM-DD-YYYY or YYYY-MM-DD.
 * property_blocked_dates uses YYYY-MM-DD DATE columns.
 *
 * Public listing availability runs in SQL (`search_public_properties` /
 * `search_public_parkings` NOT EXISTS against bookings + owner blocks) with the same
 * half-open model; this module keeps request-range parsing and the overlap rule.
 */

import { isValidCalendarDateKey } from './propertyBlockedDates.ts';

export type DateRangeYmd = {
  checkIn: string;
  checkOut: string;
};

function parseFlexibleDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [m, d, y] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  return null;
}

/** Half-open range overlap: [aStart, aEnd) intersects [bStart, bEnd). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function parseRequestedRange(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
): DateRangeYmd | null {
  if (!checkIn || !checkOut) return null;
  if (!isValidCalendarDateKey(checkIn) || !isValidCalendarDateKey(checkOut)) return null;
  const start = parseFlexibleDate(checkIn);
  const end = parseFlexibleDate(checkOut);
  if (!start || !end || !(start < end)) return null;
  return { checkIn, checkOut };
}
