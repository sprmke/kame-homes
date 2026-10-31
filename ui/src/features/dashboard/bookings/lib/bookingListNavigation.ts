import {
  bookingDetailPath,
  parkingBookingDetailPath,
} from '@/features/dashboard/org/lib/tenantPaths';

import type { BookingRow } from './types';

export type BookingsListScope = 'property' | 'org' | 'parking';

export function resolveBookingListHref(
  row: BookingRow,
  options: {
    orgSlug: string | null;
    propertySlug?: string | null;
    scope: BookingsListScope;
  }
): string {
  const isParking = row.booking_kind === 'parking' || Boolean(row.parking_id);
  if (isParking && options.orgSlug && row.parking_slug) {
    return parkingBookingDetailPath(options.orgSlug, row.parking_slug, row.id);
  }
  const slug =
    options.scope === 'org' ? row.property_slug : (options.propertySlug ?? row.property_slug);
  if (options.orgSlug && slug) {
    return bookingDetailPath(options.orgSlug, slug, row.id);
  }
  return `/bookings/${row.id}`;
}

/** Property slug from route context, falling back to the booking row on org-wide lists. */
export function resolveBookingPropertySlug(
  booking: Pick<BookingRow, 'property_slug'>,
  propertySlugFromContext?: string | null
): string | null {
  return propertySlugFromContext ?? booking.property_slug ?? null;
}

export { bookingDetailPath, parkingBookingDetailPath };
