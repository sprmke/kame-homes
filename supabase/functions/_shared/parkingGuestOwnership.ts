/**
 * Parking guest ownership — Phase B (pay-parking marketplace connect).
 *
 * Hosts may submit via Admin "New booking" with a guest email that is not the
 * caller's. Pay/cancel must then allow the real guest once they sign in with
 * that email. Id match stays the fast path; email match rebinds `guest_auth_user_id`.
 */

import type { SupabaseClient } from './supabaseJs.ts';

export type ParkingGuestOwnershipBooking = {
  id: string;
  guest_auth_user_id: string | null;
  guest_email: string | null;
};

export type ParkingGuestCaller = {
  id: string;
  email: string | null | undefined;
};

export class ParkingGuestOwnershipError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Returns true when the caller owns the parking booking (auth id or guest email).
 * On email match with a stale host `guest_auth_user_id`, rebinds ownership to the caller.
 */
export async function assertParkingGuestOwnership(
  supabase: SupabaseClient,
  booking: ParkingGuestOwnershipBooking,
  caller: ParkingGuestCaller
): Promise<void> {
  if (String(booking.guest_auth_user_id ?? '') === caller.id) {
    return;
  }

  const bookingEmail = normalizeEmail(booking.guest_email);
  const callerEmail = normalizeEmail(caller.email);
  if (!bookingEmail || !callerEmail || bookingEmail !== callerEmail) {
    throw new ParkingGuestOwnershipError('Not your booking', 403);
  }

  // Rebind so subsequent pay/cancel/endorsement checks are id-based (one write, best-effort).
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('guest_submissions')
    .update({ guest_auth_user_id: caller.id, updated_at: nowIso })
    .eq('id', booking.id)
    .eq('guest_email', booking.guest_email);
  if (error) {
    console.error('[assertParkingGuestOwnership] rebind failed:', error.message);
  }
}

/**
 * Resolve which auth user id to stamp on insert.
 * Self-service → caller. Host-on-behalf → keep caller id (creator audit); guest
 * recovers via email match + rebind when they sign in.
 */
export function resolveParkingSubmitGuestAuthUserId(
  callerUserId: string,
  _isSelfServiceGuestSubmit: boolean
): string {
  return callerUserId;
}
