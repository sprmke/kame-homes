/**
 * Links for live entity cards in chat. Booking cards only carry ids, so the detail link is
 * rebuilt from the booking's property / parking id and the org's listing slugs.
 */

type Listing = { id: string; slug: string };

export function bookingDetailHref(input: {
  orgSlug: string | null;
  bookingId: string;
  propertyId?: string | null;
  parkingId?: string | null;
  properties?: Listing[];
  parkings?: Listing[];
}): string | null {
  if (!input.orgSlug || !input.bookingId) return null;
  if (input.propertyId) {
    const property = input.properties?.find((entry) => entry.id === input.propertyId);
    return property
      ? `/org/${input.orgSlug}/property/${property.slug}/bookings/${input.bookingId}`
      : null;
  }
  if (input.parkingId) {
    const parking = input.parkings?.find((entry) => entry.id === input.parkingId);
    return parking
      ? `/org/${input.orgSlug}/parking/${parking.slug}/bookings/${input.bookingId}`
      : null;
  }
  return null;
}
