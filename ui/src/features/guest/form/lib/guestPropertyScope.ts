/** Public guest routes — property slug from path (`/properties/:slug/...`) or `?property=`. */

export function readGuestPropertySlug(searchParams: URLSearchParams): string | null {
  const slug = searchParams.get('property')?.trim() || searchParams.get('property_slug')?.trim();
  return slug || null;
}

export function guestBookedDatesUrl(
  apiUrl: string,
  propertySlug: string | null,
  searchParams?: URLSearchParams
): string {
  const slug = propertySlug?.trim() || (searchParams ? readGuestPropertySlug(searchParams) : null);
  if (!slug) return `${apiUrl}/get-booked-dates`;
  const params = new URLSearchParams({ property: slug });
  return `${apiUrl}/get-booked-dates?${params.toString()}`;
}

export function appendGuestPropertyToParams(
  params: URLSearchParams,
  propertySlug: string | null,
  searchParams?: URLSearchParams
): URLSearchParams {
  const slug = propertySlug?.trim() || (searchParams ? readGuestPropertySlug(searchParams) : null);
  if (slug) params.set('property', slug);
  return params;
}
