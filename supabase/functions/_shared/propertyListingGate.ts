/**
 * New-booking gate for a property listing.
 *
 * Public guest calls resolve the property from the `?property=` slug, and that lookup
 * deliberately ignores `properties.status` (admins load drafts through the same helper).
 * Every brand-new submission has to pass this gate instead. Bookings that already exist
 * are exempt: a guest keeps editing and viewing their stay while the host pauses or
 * archives the listing.
 */

import { createServiceClient } from './orgAuth.ts';

export const PROPERTY_NOT_ACCEPTING_BOOKINGS_CODE = 'PROPERTY_NOT_ACCEPTING_BOOKINGS';

export const PROPERTY_NOT_ACCEPTING_BOOKINGS_MESSAGE =
  "This place isn't taking new bookings right now.";

/** True when the listing is publicly live and may take a new booking. */
export async function propertyAcceptsNewBookings(propertyId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('status')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.error('[propertyListingGate] status lookup:', error.message);
    throw new Error('Could not check this property. Try again in a moment.');
  }

  return propertyStatusAcceptsNewBookings(data?.status as string | null | undefined);
}

/** Only `ACTIVE` listings take new bookings. Everything else is closed to new guests. */
export function propertyStatusAcceptsNewBookings(status: string | null | undefined): boolean {
  return String(status ?? '').toUpperCase() === 'ACTIVE';
}

/** Throws the guest-facing rejection used by `submit-form`. */
export function propertyNotAcceptingBookingsError(): Error {
  return new Error(
    `${PROPERTY_NOT_ACCEPTING_BOOKINGS_CODE}: ${PROPERTY_NOT_ACCEPTING_BOOKINGS_MESSAGE}`
  );
}
