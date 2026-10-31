import {
  BookOpen,
  Car,
  CreditCard,
  Home,
  MessageCircle,
  Navigation,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react';

import {
  guestFormPath,
  guestMessagesPath,
  guestPropertyPath,
  guestReviewPath,
  guestSdFormPath,
} from '@/features/guest/lib/guestPublicPaths';
import type { GuestTrip } from '@/features/guest/trip/lib/guestTripApi';
import type { GuestTripNextActionKind } from '@/features/guest/trip/lib/guestTripPhase';

/** `to` is an app path, an external URL, or an in-page `#anchor`. */
export type GuestTripActionLink = { label: string; to: string; Icon: LucideIcon };

export function isExternalHref(href: string): boolean {
  return /^(https?:|tel:|mailto:)/i.test(href);
}

/** Property chat with the stay dates pre-filled (guest signs in there if needed). */
export function guestTripMessageHostPath(trip: GuestTrip): string {
  return guestMessagesPath(
    trip.property.slug,
    new URLSearchParams({
      checkInDate: trip.stay.checkInDate,
      checkOutDate: trip.stay.checkOutDate,
    })
  );
}

export function guestTripEditBookingPath(trip: GuestTrip): string {
  return guestFormPath(trip.property.slug, new URLSearchParams({ bookingId: trip.bookingId }));
}

/** Listing `mapsUrl`, else coordinates, else the address as a Google Maps search. */
export function guestTripDirectionsUrl(input: {
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}): string | null {
  const mapsUrl = input.mapsUrl?.trim();
  if (mapsUrl) return mapsUrl;
  const base = 'https://www.google.com/maps/search/?api=1&query=';
  if (input.latitude != null && input.longitude != null) {
    return `${base}${input.latitude},${input.longitude}`;
  }
  const address = input.address?.trim();
  return address ? `${base}${encodeURIComponent(address)}` : null;
}

export function guestTripNextActionLink(
  kind: GuestTripNextActionKind,
  trip: GuestTrip,
  opts: { amountDueLabel: string | null; directionsUrl: string | null }
): GuestTripActionLink {
  const slug = trip.property.slug;
  switch (kind) {
    case 'pay':
      return {
        label: opts.amountDueLabel ? `Pay ${opts.amountDueLabel}` : 'How to pay',
        to: '#trip-payment',
        Icon: CreditCard,
      };
    case 'sd_form':
      return {
        label: 'Request deposit refund',
        to: guestSdFormPath(slug, trip.bookingId),
        Icon: ShieldCheck,
      };
    case 'review':
      return { label: 'Leave a review', to: guestReviewPath(slug, trip.bookingId), Icon: Star };
    case 'stay_guide':
      return { label: 'Open stay guide', to: trip.stayGuidePath ?? '', Icon: BookOpen };
    case 'directions':
      return { label: 'Get directions', to: opts.directionsUrl ?? '', Icon: Navigation };
    case 'find_parking':
      return { label: 'Find parking', to: trip.parking.findPath ?? '/parkings', Icon: Car };
    case 'book_again':
      return { label: 'Book again', to: guestPropertyPath(slug), Icon: Home };
    case 'message_host':
      return { label: 'Message host', to: guestTripMessageHostPath(trip), Icon: MessageCircle };
  }
}
