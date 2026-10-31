/** Property-scoped public guest URLs (`/properties/:propertySlug/...`). */

import {
  formatDateToYYYYMMDD,
  getManilaYmdToday,
  getManilaYmdTomorrow,
} from '@/utils/format/dates';

function propertyBase(propertySlug: string): string {
  const slug = propertySlug.trim();
  if (!slug) return '/properties';
  return `/properties/${encodeURIComponent(slug)}`;
}

function withQuery(path: string, search?: URLSearchParams | string): string {
  if (!search) return path;
  const qs = search instanceof URLSearchParams ? search.toString() : search.trim();
  return qs ? `${path}?${qs}` : path;
}

export function guestCalendarPath(propertySlug: string, search?: URLSearchParams | string): string {
  return withQuery(`${propertyBase(propertySlug)}/calendar`, search);
}

/** Public marketing listing page (`/properties/:propertySlug`). */
export function guestPropertyPath(propertySlug: string): string {
  return propertyBase(propertySlug);
}

/** Open the property page date picker (`pickDates=contactHost` | `pickDates=reserve`). */
export function guestPropertyPickDatesPath(
  propertySlug: string,
  intent: 'contactHost' | 'reserve' = 'contactHost'
): string {
  const params = new URLSearchParams();
  params.set('pickDates', intent);
  return withQuery(guestPropertyPath(propertySlug), params);
}

/** Re-open Contact host sheet after OAuth (`contactHost=open`; dates optional). */
export function guestParkingContactHostOpenPath(
  parkingSlug: string,
  checkInDate?: string,
  checkOutDate?: string
): string {
  const params = new URLSearchParams();
  params.set('contactHost', 'open');
  const inDate = checkInDate?.trim() ?? '';
  const outDate = checkOutDate?.trim() ?? '';
  if (inDate && outDate) {
    params.set('checkInDate', inDate);
    params.set('checkOutDate', outDate);
  }
  return withQuery(guestParkingPath(parkingSlug), params);
}

/** Open the parking page date picker (`pickDates=contactHost` | `pickDates=reserve`). */
export function guestParkingPickDatesPath(
  parkingSlug: string,
  intent: 'contactHost' | 'reserve' = 'contactHost'
): string {
  const params = new URLSearchParams();
  params.set('pickDates', intent);
  return withQuery(guestParkingPath(parkingSlug), params);
}

/** Re-open Contact host sheet after OAuth (`contactHost=open`; dates optional). */
export function guestPropertyContactHostOpenPath(
  propertySlug: string,
  checkInDate?: string,
  checkOutDate?: string
): string {
  const params = new URLSearchParams();
  params.set('contactHost', 'open');
  const inDate = checkInDate?.trim() ?? '';
  const outDate = checkOutDate?.trim() ?? '';
  if (inDate && outDate) {
    params.set('checkInDate', inDate);
    params.set('checkOutDate', outDate);
  }
  return withQuery(guestPropertyPath(propertySlug), params);
}

/** Re-open Guest booking form modal after OAuth (`reserveForm=open`; dates + guests optional). */
export function guestPropertyReserveFormOpenPath(
  propertySlug: string,
  options?: {
    checkInDate?: string;
    checkOutDate?: string;
    adults?: number;
    children?: number;
  }
): string {
  const params = new URLSearchParams();
  params.set('reserveForm', 'open');
  const inDate = options?.checkInDate?.trim() ?? '';
  const outDate = options?.checkOutDate?.trim() ?? '';
  if (inDate && outDate) {
    params.set('checkInDate', inDate);
    params.set('checkOutDate', outDate);
  }
  if (options?.adults != null && options.adults >= 1) {
    params.set('adults', String(options.adults));
  }
  if (options?.children != null && options.children >= 0) {
    params.set('children', String(options.children));
  }
  return withQuery(guestPropertyPath(propertySlug), params);
}

export function guestFormPath(propertySlug: string, search?: URLSearchParams | string): string {
  return withQuery(`${propertyBase(propertySlug)}/form`, search);
}

export function guestMessagesPath(propertySlug: string, search?: URLSearchParams | string): string {
  return withQuery(`${propertyBase(propertySlug)}/messages`, search);
}

/** Host dashboard preview — inquiry dates required by PropertyChatPage (check-in today, Manila). */
export function guestMessagesPreviewPath(propertySlug: string): string {
  const params = new URLSearchParams();
  params.set('checkInDate', getManilaYmdToday());
  params.set('checkOutDate', getManilaYmdTomorrow());
  return guestMessagesPath(propertySlug, params);
}

/** Guest SD refund form — booking link adds `?bookingId=` via `guestSdFormPath`. */
export function guestSdFormShellPath(propertySlug: string): string {
  return `${propertyBase(propertySlug)}/sd-form`;
}

/** Post-stay guest review — booking link adds `?bookingId=` via `guestReviewPath`. */
export function guestReviewShellPath(propertySlug: string): string {
  return `${propertyBase(propertySlug)}/guest-review`;
}

export type GuestChatPathOptions = {
  checkIn: Date;
  checkOut: Date;
};

export function guestChatPath(propertySlug: string, options: GuestChatPathOptions): string {
  const params = new URLSearchParams();
  params.set('checkInDate', formatDateToYYYYMMDD(options.checkIn));
  params.set('checkOutDate', formatDateToYYYYMMDD(options.checkOut));
  return withQuery(`${propertyBase(propertySlug)}/messages`, params);
}

export function guestSuccessPath(propertySlug: string, search?: URLSearchParams | string): string {
  return withQuery(`${propertyBase(propertySlug)}/success`, search);
}

export function guestSdFormPath(
  propertySlug: string,
  bookingId: string,
  extra?: URLSearchParams
): string {
  const params = new URLSearchParams(extra);
  params.set('bookingId', bookingId);
  return withQuery(`${propertyBase(propertySlug)}/sd-form`, params);
}

export function guestReviewPath(
  propertySlug: string,
  bookingId: string,
  extra?: URLSearchParams
): string {
  const params = new URLSearchParams(extra);
  params.set('bookingId', bookingId);
  return withQuery(`${propertyBase(propertySlug)}/guest-review`, params);
}

export type GuestPayParkingPathOptions = {
  admin?: boolean;
};

/** Placeholder booking id for dashboard Public Pages iframe preview (`/parking/preview`). */
export const GUEST_PAY_PARKING_PREVIEW_BOOKING_ID = 'preview';

export function guestPayParkingPath(
  propertySlug: string,
  bookingId: string,
  options: GuestPayParkingPathOptions = {}
): string {
  const base = `${propertyBase(propertySlug)}/parking/${encodeURIComponent(bookingId)}`;
  if (options.admin) return `${base}?admin=true`;
  return base;
}

export function guestPayParkingPreviewPath(propertySlug: string): string {
  return guestPayParkingPath(propertySlug, GUEST_PAY_PARKING_PREVIEW_BOOKING_ID);
}

/** Prefix for per-booking pay-parking URLs (`…/parking/<bookingId>`). */
export function guestPayParkingPathPrefix(propertySlug: string): string {
  return `${propertyBase(propertySlug)}/parking/`;
}

/** Guest trip hub for one booking. Access token stays in sessionStorage, not the URL. */
export function guestTripPath(propertySlug: string, bookingId: string): string {
  const params = new URLSearchParams({ bookingId: bookingId.trim() });
  return withQuery(`${propertyBase(propertySlug)}/trip`, params);
}

export function guestStayGuidePath(propertySlug: string, token: string): string {
  const params = new URLSearchParams({ token: token.trim() });
  return withQuery(`${propertyBase(propertySlug)}/stay-guide`, params);
}

/** Admin preview — sample booking placeholders; requires signed-in host session on the page. */
export function guestStayGuidePreviewPath(propertySlug: string, propertyId: string): string {
  const params = new URLSearchParams({
    preview: '1',
    property_id: propertyId.trim(),
  });
  return withQuery(`${propertyBase(propertySlug)}/stay-guide`, params);
}

export function guestBookingDocumentPath(
  propertySlug: string,
  token: string,
  doc: 'gaf' | 'pet'
): string {
  const params = new URLSearchParams({ token: token.trim(), doc });
  return withQuery(`${propertyBase(propertySlug)}/document`, params);
}

export function absoluteGuestCalendarUrl(propertySlug: string): string {
  return absoluteGuestPath(guestCalendarPath(propertySlug));
}

export function absoluteGuestPropertyUrl(propertySlug: string): string {
  return absoluteGuestPath(guestPropertyPath(propertySlug));
}

export function guestShowcasePath(propertySlug: string): string {
  return `${propertyBase(propertySlug)}/showcase`;
}

export function absoluteGuestShowcaseUrl(propertySlug: string): string {
  return absoluteGuestPath(guestShowcasePath(propertySlug));
}

export function absoluteGuestPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return normalized;
  return `${window.location.origin}${normalized}`;
}

export function guestParkingPath(parkingSlug: string): string {
  const slug = parkingSlug.trim();
  if (!slug) return '/parkings';
  return `/parkings/${encodeURIComponent(slug)}`;
}

/** Re-open Parking booking form modal after OAuth (`reserveForm=open`; dates optional). */
export function guestParkingReserveFormOpenPath(
  parkingSlug: string,
  options?: { checkInDate?: string; checkOutDate?: string }
): string {
  const params = new URLSearchParams();
  params.set('reserveForm', 'open');
  const inDate = options?.checkInDate?.trim() ?? '';
  const outDate = options?.checkOutDate?.trim() ?? '';
  if (inDate && outDate) {
    params.set('checkInDate', inDate);
    params.set('checkOutDate', outDate);
  }
  return withQuery(guestParkingPath(parkingSlug), params);
}

export function guestParkingFormPath(
  parkingSlug: string,
  search?: URLSearchParams | string
): string {
  const slug = parkingSlug.trim();
  if (!slug) return '/parkings';
  return withQuery(`${guestParkingPath(slug)}/form`, search);
}

export function absoluteGuestParkingUrl(parkingSlug: string): string {
  if (typeof window === 'undefined') return guestParkingPath(parkingSlug);
  return `${window.location.origin}${guestParkingPath(parkingSlug)}`;
}

export function absoluteGuestParkingFormUrl(parkingSlug: string): string {
  if (typeof window === 'undefined') return guestParkingFormPath(parkingSlug);
  return `${window.location.origin}${guestParkingFormPath(parkingSlug)}`;
}

export function guestParkingRequestStatusPath(bookingId: string): string {
  const id = bookingId.trim();
  if (!id) return '/parkings';
  return `/parkings/requests/${encodeURIComponent(id)}`;
}

/** Query param that pre-binds a property stay for marketplace linking (Phase pay-parking connect). */
export const GUEST_PARKING_LINK_STAY_PARAM = 'linkStay';

export type GuestParkingFindPathOptions = {
  /** Property booking id to auto-select as the linked stay after guest auth. */
  bookingId: string;
  /** Optional city slug → `/parkings/in/:location` instead of `/parkings`. */
  locationSlug?: string | null;
};

/**
 * Stay-scoped marketplace entry — browse/search with `linkStay` so Reserve/form
 * can auto-select the property booking. Prefer this over legacy pay-parking URLs.
 */
export function guestParkingFindPath(options: GuestParkingFindPathOptions): string {
  const bookingId = options.bookingId.trim();
  if (!bookingId) return '/parkings';
  const params = new URLSearchParams();
  params.set(GUEST_PARKING_LINK_STAY_PARAM, bookingId);
  const locationSlug = (options.locationSlug ?? '').trim().toLowerCase();
  const base =
    locationSlug && locationSlug !== 'other'
      ? `/parkings/in/${encodeURIComponent(locationSlug)}`
      : '/parkings';
  return withQuery(base, params);
}

export function absoluteGuestParkingFindUrl(options: GuestParkingFindPathOptions): string {
  return absoluteGuestPath(guestParkingFindPath(options));
}

export type GuestParkingOwnDefaultPathOptions = {
  parkingSlug: string;
  bookingId: string;
  /** YYYY-MM-DD preferred. */
  checkInDate?: string | null;
  checkOutDate?: string | null;
};

/** Pinned org-owned slot form with stay link + optional stay dates prefilled. */
export function guestParkingOwnDefaultPath(options: GuestParkingOwnDefaultPathOptions): string {
  const slug = options.parkingSlug.trim();
  const bookingId = options.bookingId.trim();
  if (!slug) return bookingId ? guestParkingFindPath({ bookingId }) : '/parkings';
  const params = new URLSearchParams();
  if (bookingId) params.set(GUEST_PARKING_LINK_STAY_PARAM, bookingId);
  const inDate = (options.checkInDate ?? '').trim();
  const outDate = (options.checkOutDate ?? '').trim();
  if (inDate && outDate) {
    params.set('checkInDate', inDate);
    params.set('checkOutDate', outDate);
  }
  return guestParkingFormPath(slug, params);
}

export function absoluteGuestParkingOwnDefaultUrl(
  options: GuestParkingOwnDefaultPathOptions
): string {
  return absoluteGuestPath(guestParkingOwnDefaultPath(options));
}

export function absoluteGuestFormUrl(propertySlug: string): string {
  return absoluteGuestPath(guestFormPath(propertySlug));
}

/** Public host (organization) profile — guest marketing. Prefer over `/orgs/` (admin uses `/org/`). */
export function guestHostPath(orgSlug: string): string {
  const slug = orgSlug.trim();
  if (!slug) return '/properties';
  return `/hosts/${encodeURIComponent(slug)}`;
}

/** Origin-prefixed prefix for read-only slug fields (property public listing). */
export function publicPropertySlugUrlPrefix(): string {
  if (typeof window === 'undefined') return '/properties/';
  return `${window.location.origin}/properties/`;
}

/** Origin-prefixed prefix for read-only slug fields (host public profile). */
export function publicHostSlugUrlPrefix(): string {
  if (typeof window === 'undefined') return '/hosts/';
  return `${window.location.origin}/hosts/`;
}
