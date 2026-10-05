/**
 * Mint guest booking access tokens for outbound email links (SD form, form resume, review).
 */

import { mintGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import {
  guestFormPath,
  guestGuestReviewPath,
  guestSdFormPath,
  guestTripPath,
} from './publicGuestPaths.ts';

export type GuestBookingEmailLinks = {
  accessToken: string;
  formUrl: string;
  sdFormUrl: string;
  reviewUrl: string;
  tripUrl: string;
};

export type GuestBookingEmailLinkPlaceholderExtras = {
  property_slug: string;
  form_url: string;
  sd_form_url: string;
  review_url: string;
  trip_url: string;
};

/** Tokenized guest URLs for `buildBookingPlaceholderVars` extras. */
export async function guestBookingEmailLinkPlaceholderExtras(input: {
  origin: string;
  propertySlug: string;
  bookingId: string;
}): Promise<GuestBookingEmailLinkPlaceholderExtras> {
  const links = await buildGuestBookingEmailLinks(input);
  return {
    property_slug: input.propertySlug.trim(),
    form_url: links.formUrl,
    sd_form_url: links.sdFormUrl,
    review_url: links.reviewUrl,
    trip_url: links.tripUrl,
  };
}

export async function buildGuestBookingEmailLinks(input: {
  origin: string;
  propertySlug: string;
  bookingId: string;
}): Promise<GuestBookingEmailLinks> {
  const bookingId = input.bookingId.trim();
  if (!bookingId) throw new Error('bookingId required');
  const accessToken = await mintGuestBookingAccessToken(bookingId);
  const origin = input.origin.replace(/\/+$/, '');
  const propertySlug = input.propertySlug.trim();
  return {
    accessToken,
    formUrl: guestFormPath(origin, propertySlug, bookingId, accessToken),
    sdFormUrl: guestSdFormPath(origin, propertySlug, bookingId, accessToken),
    reviewUrl: guestGuestReviewPath(origin, propertySlug, bookingId, accessToken),
    tripUrl: guestTripPath(origin, propertySlug, bookingId, accessToken),
  };
}
