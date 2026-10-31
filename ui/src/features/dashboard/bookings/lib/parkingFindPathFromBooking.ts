import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import {
  absoluteGuestParkingFindUrl,
  absoluteGuestParkingOwnDefaultUrl,
  guestParkingFindPath,
  guestParkingOwnDefaultPath,
} from '@/features/guest/lib/guestPublicPaths';
import {
  toLocationSlug,
  normalizeCityPlace,
} from '@/features/guest/marketing/shared/lib/locationSlug';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

dayjs.extend(customParseFormat);

/** Resolve optional city slug from property settings for stay-scoped find URLs. */
export function propertyCityLocationSlug(
  propertySettings: Record<string, unknown> | null | undefined
): string | null {
  const cityRaw = propertySettings?.city;
  if (typeof cityRaw !== 'string' || !cityRaw.trim()) return null;
  const place = normalizeCityPlace(cityRaw);
  if (!place || place === 'Other') return null;
  return toLocationSlug(place);
}

/** Booking `MM-DD-YYYY` (or ISO) → `YYYY-MM-DD` for public parking query params. */
export function bookingDateToYmd(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = dayjs(raw, 'MM-DD-YYYY', true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

export function bookingParkingFindPath(
  booking: Pick<BookingRow, 'id'>,
  locationSlug?: string | null
): string {
  return guestParkingFindPath({ bookingId: booking.id, locationSlug });
}

export function absoluteBookingParkingFindUrl(
  booking: Pick<BookingRow, 'id'>,
  locationSlug?: string | null
): string {
  return absoluteGuestParkingFindUrl({ bookingId: booking.id, locationSlug });
}

export function bookingParkingOwnDefaultPath(
  booking: Pick<BookingRow, 'id' | 'check_in_date' | 'check_out_date'>,
  parkingSlug: string
): string {
  return guestParkingOwnDefaultPath({
    parkingSlug,
    bookingId: booking.id,
    checkInDate: bookingDateToYmd(booking.check_in_date),
    checkOutDate: bookingDateToYmd(booking.check_out_date),
  });
}

export function absoluteBookingParkingOwnDefaultUrl(
  booking: Pick<BookingRow, 'id' | 'check_in_date' | 'check_out_date'>,
  parkingSlug: string
): string {
  return absoluteGuestParkingOwnDefaultUrl({
    parkingSlug,
    bookingId: booking.id,
    checkInDate: bookingDateToYmd(booking.check_in_date),
    checkOutDate: bookingDateToYmd(booking.check_out_date),
  });
}
