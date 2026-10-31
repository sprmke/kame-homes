/**
 * Guest-side anti-spam for parking requests (Phase 3 fast-follow, overview decision D15) —
 * fixed v1 constants, not admin-configurable, until real usage shows they need tuning.
 */

import { createServiceClient } from './orgAuth.ts';

/** Locked v1 defaults (overview D15). */
export const PARKING_MAX_CONCURRENT_PENDING = 3;
export const PARKING_CANCELLATION_COOLDOWN_THRESHOLD = 3;
export const PARKING_CANCELLATION_COOLDOWN_HOURS = 24;

export class ParkingAntiSpamError extends Error {
  status = 429;
}

/**
 * Throws if the guest already has too many live requests, or has cancelled too many
 * recently. Approximate on purpose: counts any `CANCELLED` row tied to this guest's
 * `guest_auth_user_id`, not strictly only self-service cancels (an admin cancelling on the
 * guest's behalf would also count) — acceptable imprecision for a v1 heuristic, not worth a
 * new column to disambiguate.
 */
export async function assertParkingSubmitAllowed(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const cooldownSinceIso = new Date(
    Date.now() - PARKING_CANCELLATION_COOLDOWN_HOURS * 60 * 60_000
  ).toISOString();

  const [pendingResult, recentCancelResult] = await Promise.all([
    supabase
      .from('guest_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('guest_auth_user_id', userId)
      .in('status', ['PENDING_HOST_ACCEPTANCE', 'PENDING_PAYMENT']),
    supabase
      .from('guest_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('guest_auth_user_id', userId)
      .eq('status', 'CANCELLED')
      .gte('status_updated_at', cooldownSinceIso),
  ]);

  if ((pendingResult.count ?? 0) >= PARKING_MAX_CONCURRENT_PENDING) {
    throw new ParkingAntiSpamError(
      'You have too many pending parking requests. Wait for one to resolve before submitting another.'
    );
  }
  if ((recentCancelResult.count ?? 0) >= PARKING_CANCELLATION_COOLDOWN_THRESHOLD) {
    throw new ParkingAntiSpamError(
      "You've cancelled too many requests recently. Please try again later."
    );
  }
}
