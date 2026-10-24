const STORAGE_PREFIX = 'guest-booking-access:';

export function storeGuestBookingAccessToken(bookingId: string, token: string): void {
  const id = bookingId.trim();
  const value = token.trim();
  if (!id || !value) return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${id}`, value);
  } catch {
    // ignore quota / private mode
  }
}

export function readGuestBookingAccessToken(bookingId: string): string | null {
  const id = bookingId.trim();
  if (!id) return null;
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${id}`)?.trim() ?? null;
  } catch {
    return null;
  }
}

export function guestEdgeGetUrl(apiUrl: string, functionName: string, bookingId: string): string {
  const id = bookingId.trim();
  const params = new URLSearchParams({ bookingId: id });
  const access = readGuestBookingAccessToken(id);
  if (access) params.set('access', access);
  return `${apiUrl}/${functionName}?${params.toString()}`;
}

export function guestFormFetchUrl(apiUrl: string, bookingId: string): string {
  return `${apiUrl}/get-form/${bookingId.trim()}${accessQuerySuffix(bookingId)}`;
}

export function guestSdFormFetchUrl(apiUrl: string, bookingId: string): string {
  return guestEdgeGetUrl(apiUrl, 'get-sd-form', bookingId);
}

export function guestReviewFetchUrl(apiUrl: string, bookingId: string): string {
  return guestEdgeGetUrl(apiUrl, 'get-guest-review', bookingId);
}

function accessQuerySuffix(bookingId: string): string {
  const access = readGuestBookingAccessToken(bookingId.trim());
  if (!access) return '';
  return `?access=${encodeURIComponent(access)}`;
}

/** Persist `?access=` from an email deep link into sessionStorage for this booking. */
export function captureGuestBookingAccessFromSearchParams(
  bookingId: string,
  searchParams: URLSearchParams
): void {
  const access = searchParams.get('access')?.trim();
  if (access) storeGuestBookingAccessToken(bookingId, access);
}

export function guestBookingAccessFields(bookingId: string): { access?: string } {
  const access = readGuestBookingAccessToken(bookingId);
  return access ? { access } : {};
}

export function appendGuestBookingAccess(form: FormData, bookingId: string): void {
  const access = readGuestBookingAccessToken(bookingId);
  if (access) form.append('access', access);
}
