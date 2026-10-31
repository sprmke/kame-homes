import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { formatBookingDateShort } from '@/utils/format/bookingDisplay';

dayjs.extend(customParseFormat);

export type BookingPickerMonthGroup = {
  key: string;
  label: string;
  items: BookingRow[];
};

export function bookingGuestName(row: BookingRow): string {
  return row.primary_guest_name || row.guest_facebook_name || 'Guest';
}

export function bookingStayRange(row: BookingRow): string {
  return `${formatBookingDateShort(row.check_in_date)}–${formatBookingDateShort(row.check_out_date)}`;
}

export function bookingRowLabel(row: BookingRow): string {
  return `${bookingGuestName(row)} · ${bookingStayRange(row)}`;
}

function parseCheckIn(raw: string | null | undefined) {
  if (!raw) return null;
  const mmdd = dayjs(raw, 'MM-DD-YYYY', true);
  if (mmdd.isValid()) return mmdd;
  const iso = dayjs(raw.slice(0, 10), 'YYYY-MM-DD', true);
  return iso.isValid() ? iso : null;
}

export function bookingSearchHaystack(row: BookingRow): string {
  return [
    bookingGuestName(row),
    bookingStayRange(row),
    formatBookingDateShort(row.check_in_date),
    row.property_name,
    statusLabel(row.status),
    row.status,
  ]
    .filter(Boolean)
    .join(' ');
}

export function groupByCheckInMonth(rows: BookingRow[]): BookingPickerMonthGroup[] {
  const map = new Map<string, BookingPickerMonthGroup>();
  const unknown: BookingRow[] = [];

  for (const row of rows) {
    const checkIn = parseCheckIn(row.check_in_date);
    if (!checkIn) {
      unknown.push(row);
      continue;
    }
    const key = checkIn.format('YYYY-MM');
    const existing = map.get(key);
    if (existing) {
      existing.items.push(row);
    } else {
      map.set(key, { key, label: checkIn.format('MMMM YYYY'), items: [row] });
    }
  }

  const groups = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  if (unknown.length > 0) {
    groups.push({ key: 'unknown', label: 'No date', items: unknown });
  }
  return groups;
}
