/**
 * Guest trip hub access: a valid HMAC booking access token for this booking, or the signed-in
 * guest who owns it (`guest_user_id`, or matching `guest_email` which then links the row).
 * A bare booking id is never enough here, even while `GUEST_BOOKING_ACCESS_ENFORCE` is off.
 */

import { verifyGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import { createServiceClient, type AuthenticatedUser } from './orgAuth.ts';

type BookingRow = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export type GuestTripAccessResult =
  { ok: true; via: 'token' | 'owner' } | { ok: false; reason: 'sign_in_required' | 'forbidden' };

/** Token for this booking wins; otherwise the signed-in owner (links by email on first visit). */
export async function authorizeGuestTripAccess(input: {
  booking: BookingRow;
  accessToken: string | null;
  user: AuthenticatedUser | null;
}): Promise<GuestTripAccessResult> {
  const bookingId = str(input.booking.id);
  const access = input.accessToken?.trim() ?? '';
  if (access) {
    const verified = await verifyGuestBookingAccessToken(access);
    if (verified.ok && verified.bookingId === bookingId) return { ok: true, via: 'token' };
  }

  const user = input.user;
  if (!user) return { ok: false, reason: 'sign_in_required' };

  const ownerId = str(input.booking.guest_user_id);
  if (ownerId) {
    return ownerId === user.id ? { ok: true, via: 'owner' } : { ok: false, reason: 'forbidden' };
  }

  const bookingEmail = str(input.booking.guest_email).toLowerCase();
  const userEmail = user.email.trim().toLowerCase();
  if (!bookingEmail || bookingEmail !== userEmail) return { ok: false, reason: 'forbidden' };

  const { error } = await createServiceClient()
    .from('guest_submissions')
    .update({ guest_user_id: user.id })
    .eq('id', bookingId)
    .is('guest_user_id', null);
  if (error) console.error('[guestTrip] link booking to guest failed:', error.message);
  return { ok: true, via: 'owner' };
}
