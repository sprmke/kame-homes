/**
 * Phase 8 — direct-booking link token: lazily generated per parking listing, verified at submit
 * time to tag a booking's commission channel. Token pattern mirrors the existing invite-token
 * generator in `parkingTeamService.ts` (two concatenated UUIDs, no hyphens) for consistency.
 */

import { createServiceClient } from './orgAuth.ts';

export type ParkingBookingChannel = 'standard' | 'direct_link';

function generateDirectBookingToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Read-or-create: returns the listing's existing token + slug, generating and persisting a
 * token on first call if one doesn't exist yet. Idempotent — safe to call on every dashboard
 * page load.
 */
export async function ensureParkingDirectBookingToken(
  parkingId: string
): Promise<{ token: string; slug: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('slug, direct_booking_token')
    .eq('id', parkingId)
    .maybeSingle();
  if (error || !data) {
    throw new Error('Parking not found');
  }
  const slug = String(data.slug);
  const existing = data.direct_booking_token as string | null;
  if (existing) {
    return { token: existing, slug };
  }

  const token = generateDirectBookingToken();
  const { error: updateError } = await supabase
    .from('parkings')
    .update({ direct_booking_token: token })
    .eq('id', parkingId);
  if (updateError) {
    throw new Error(`Failed to generate direct booking link: ${updateError.message}`);
  }
  return { token, slug };
}

/**
 * Verifies a guest-supplied token against the pinned listing's stored token. A missing or
 * mismatched token is never an error — it just means the booking doesn't qualify for the
 * reduced direct-link commission and falls back to 'standard' (e.g. a stale/copied-wrong link,
 * or a normal search-matched submission that never had a token to begin with).
 */
export async function resolveParkingBookingChannel(
  parkingId: string,
  directLinkToken: string | null | undefined
): Promise<ParkingBookingChannel> {
  const token = directLinkToken?.trim();
  if (!token) return 'standard';

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('parkings')
    .select('direct_booking_token')
    .eq('id', parkingId)
    .maybeSingle();

  return data?.direct_booking_token === token ? 'direct_link' : 'standard';
}
