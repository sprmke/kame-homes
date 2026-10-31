import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { formatBookingDateShort } from '@/utils/format/bookingDisplay';

export function bookingGuestName(row: BookingRow): string {
  return row.primary_guest_name || row.guest_facebook_name || 'Guest';
}

export function bookingStayRange(row: BookingRow): string {
  return `${formatBookingDateShort(row.check_in_date)}–${formatBookingDateShort(row.check_out_date)}`;
}

export function bookingSearchHaystack(row: BookingRow): string {
  return [bookingGuestName(row), bookingStayRange(row), statusLabel(row.status), row.status]
    .filter(Boolean)
    .join(' ');
}
