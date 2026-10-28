/**
 * resolve-booking-property — public bookingId → property slug lookup.
 *
 * Feeds Phase 5.2 of the legacy → mt-prod cutover plan
 * (docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md): links in emails
 * already sent from legacy (`/sd-form?bookingId=…`) carry no `?property=`. The
 * guest router calls this endpoint to resolve the property slug and redirect
 * instead of dropping the guest on `/properties`.
 *
 * Returns the slug only — no guest PII, no booking data. A booking that does
 * not exist or is CANCELLED/IMPORTED gets the same 404 (no existence oracle for
 * arbitrary ids beyond the rate-limited lookup; slugs are public listing data).
 */
import { createClient } from '../_shared/supabaseJs.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { resolvePropertySlugById } from '../_shared/propertyScope.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND: Record<string, unknown> = { success: false, error: 'Booking not found' };

servePublic('resolve-booking-property', async (req) => {
  if (req.method !== 'GET') {
    throw new Error(`Method ${req.method} not allowed`);
  }

  const limited = await publicGetRateLimitGate(req, 'resolve-booking-property');
  if (limited) return limited;

  const url = new URL(req.url);
  const bookingId = (url.searchParams.get('bookingId') ?? '').trim();
  if (!bookingId || !UUID_RE.test(bookingId)) {
    return jsonError(req, 'bookingId is required', 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase
    .from('guest_submissions')
    .select('id, property_id, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('[resolve-booking-property] database error:', error);
    throw new Error('Failed to resolve booking property');
  }
  if (!data?.property_id || data.status === 'CANCELLED' || data.status === 'IMPORTED') {
    return jsonError(req, 'Booking not found', 404);
  }

  const slug = await resolvePropertySlugById(String(data.property_id));
  if (!slug) {
    return jsonError(req, 'Booking not found', 404);
  }

  // Slug tied to a booking id — keep out of shared caches.
  return jsonSuccess(req, { property_slug: slug }, undefined, 'guestToken');
});
