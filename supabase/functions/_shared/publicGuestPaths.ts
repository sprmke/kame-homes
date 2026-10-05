/** Property-scoped public guest URLs shared by edge functions and emails. */

export function appendGuestBookingAccessQuery(
  url: string,
  accessToken: string | null | undefined
): string {
  const token = accessToken?.trim();
  if (!token) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('access', token);
  return parsed.toString();
}

export function guestFormPath(
  origin: string,
  propertySlug: string,
  bookingId: string,
  accessToken?: string | null
): string {
  const base = origin.replace(/\/+$/, '');
  const slug = propertySlug.trim();
  const id = bookingId.trim();
  if (!id) return base;
  const path = slug
    ? `${base}/properties/${encodeURIComponent(slug)}/form?bookingId=${encodeURIComponent(id)}`
    : `${base}/form?bookingId=${encodeURIComponent(id)}`;
  return appendGuestBookingAccessQuery(path, accessToken);
}

export function guestGuestReviewPath(
  origin: string,
  propertySlug: string,
  bookingId: string,
  accessToken?: string | null
): string {
  const base = origin.replace(/\/+$/, '');
  const slug = propertySlug.trim();
  const id = bookingId.trim();
  if (!id) return base;
  const path = slug
    ? `${base}/properties/${encodeURIComponent(slug)}/guest-review?bookingId=${encodeURIComponent(id)}`
    : `${base}/guest-review?bookingId=${encodeURIComponent(id)}`;
  return appendGuestBookingAccessQuery(path, accessToken);
}

/** Guest trip hub — everything for one booking (`?access=` lets anonymous guests in). */
export function guestTripPath(
  origin: string,
  propertySlug: string,
  bookingId: string,
  accessToken?: string | null
): string {
  const base = origin.replace(/\/+$/, '');
  const slug = propertySlug.trim();
  const id = bookingId.trim();
  if (!slug || !id) return base;
  const path = `${base}/properties/${encodeURIComponent(slug)}/trip?bookingId=${encodeURIComponent(id)}`;
  return appendGuestBookingAccessQuery(path, accessToken);
}

export function guestStayGuidePath(origin: string, propertySlug: string, token: string): string {
  const base = origin.replace(/\/+$/, '');
  const slug = propertySlug.trim();
  const t = token.trim();
  if (!slug || !t) return base;
  const params = new URLSearchParams({ token: t });
  return `${base}/properties/${encodeURIComponent(slug)}/stay-guide?${params.toString()}`;
}

export function guestBookingDocumentPath(
  origin: string,
  propertySlug: string,
  token: string,
  doc: 'gaf' | 'pet'
): string {
  const base = origin.replace(/\/+$/, '');
  const slug = propertySlug.trim();
  const t = token.trim();
  if (!slug || !t) return base;
  const params = new URLSearchParams({ token: t, doc });
  return `${base}/properties/${encodeURIComponent(slug)}/document?${params.toString()}`;
}

export function guestSdFormPath(
  origin: string,
  propertySlug: string,
  bookingId: string,
  accessToken?: string | null
): string {
  const base = origin.replace(/\/+$/, '');
  const slug = propertySlug.trim();
  const id = bookingId.trim();
  const path = !slug
    ? `${base}/sd-form?bookingId=${encodeURIComponent(id)}`
    : `${base}/properties/${encodeURIComponent(slug)}/sd-form?bookingId=${encodeURIComponent(id)}`;
  return appendGuestBookingAccessQuery(path, accessToken);
}

export function guestPayParkingPath(
  origin: string,
  propertySlug: string,
  bookingId: string
): string {
  const base = origin.replace(/\/+$/, '');
  const slug = propertySlug.trim();
  if (!slug) {
    return `${base}/bookings/${encodeURIComponent(bookingId)}/parking`;
  }
  return `${base}/properties/${encodeURIComponent(slug)}/parking/${encodeURIComponent(bookingId)}`;
}
