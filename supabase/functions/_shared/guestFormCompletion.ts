/**
 * Guest-form completion link for OTA-ingested bookings (calendar sync Phase 2, §6.5).
 *
 * An ingested Airbnb/OTA reservation row has locked dates but no guest details. The host
 * mints `<origin>/form?complete=<token>` and forwards it to the Airbnb guest, who fills in
 * the normal guest form against THAT existing row. Server-side, the stored dates win — a
 * tampered client cannot move them.
 *
 * Mirrors the stay-guide token mechanism (`guestStayGuide.ts`).
 */

import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { resolveAppSettings } from './appSettings.ts';
import { createServiceClient } from './orgAuth.ts';
import { resolvePropertySlugById } from './propertyScope.ts';
import type { GuestSubmission } from './types.ts';

/**
 * `<origin>/form?complete=<token>&property=<slug>` — the guest-facing completion URL.
 * `?property=` gives the form its branding / settings context before the token resolves.
 */
export function guestFormCompletionPath(
  origin: string,
  token: string,
  propertySlug: string
): string {
  const base = origin.replace(/\/+$/, '');
  const t = token.trim();
  if (!t) return base;
  const params = new URLSearchParams({ complete: t });
  if (propertySlug.trim()) params.set('property', propertySlug.trim());
  return `${base}/form?${params.toString()}`;
}

function generateCompletionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readToken(booking: { guest_form_token?: string | null }): string {
  return String(booking.guest_form_token ?? '').trim();
}

/** Non-CANCELLED and check-out is today or later (Manila). */
export function isCompletionLinkLive(booking: {
  status?: string | null;
  check_out_date?: string | null;
}): boolean {
  const status = String(booking.status ?? '').trim();
  if (status === 'CANCELLED') return false;
  const checkOutYmd = normalizeBookingDateToYmd(String(booking.check_out_date ?? ''));
  if (!checkOutYmd) return false;
  return checkOutYmd >= manilaTodayYmd();
}

export type CompletionEligibility =
  { ok: true } | { ok: false; reason: 'not_external' | 'wrong_status' | 'link_expired' };

/**
 * A token may be issued only for an OTA-ingested booking still awaiting review whose stay
 * has not ended. (`external_source` OR `booking_source='Airbnb'` covers rows created before
 * the Phase 2 provenance columns as well.)
 */
export function checkCompletionEligibility(booking: GuestSubmission): CompletionEligibility {
  const external =
    !!String((booking as { external_source?: string | null }).external_source ?? '').trim() ||
    String(booking.booking_source ?? '')
      .trim()
      .toLowerCase() === 'airbnb';
  if (!external) return { ok: false, reason: 'not_external' };
  // Stay-over / CANCELLED is checked first so the caller maps it to 410 (gone), not 409.
  if (!isCompletionLinkLive(booking)) return { ok: false, reason: 'link_expired' };
  if (String(booking.status ?? '').trim() !== 'PENDING_REVIEW') {
    return { ok: false, reason: 'wrong_status' };
  }
  return { ok: true };
}

/**
 * Mint (or rotate) the completion token for a booking. Caller must have already verified
 * property scope + `bookings.detail` permission and that the row belongs to the property.
 */
export async function issueGuestFormCompletionToken(
  booking: GuestSubmission
): Promise<{ ok: true; token: string; url: string } | { ok: false; reason: string }> {
  const eligibility = checkCompletionEligibility(booking);
  if (!eligibility.ok) return { ok: false, reason: eligibility.reason };

  const bookingId = String(booking.id ?? '').trim();
  const propertyId = String(booking.property_id ?? '').trim();
  if (!bookingId || !propertyId) return { ok: false, reason: 'invalid_booking' };

  const token = readToken(booking) || generateCompletionToken();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('guest_submissions')
    .update({
      guest_form_token: token,
      guest_form_token_issued_at: new Date().toISOString(),
    })
    .eq('id', bookingId);
  if (error) {
    console.error('[guestFormCompletion] issue token failed:', error.message);
    throw new Error('Failed to issue guest-form completion token');
  }

  const [settings, propertySlug] = await Promise.all([
    resolveAppSettings(propertyId),
    resolvePropertySlugById(propertyId),
  ]);
  const url = guestFormCompletionPath(settings.publicGuestAppOrigin, token, propertySlug ?? '');
  return { ok: true, token, url };
}

export type CompletionResolution =
  { ok: true; booking: GuestSubmission; propertySlug: string } | { ok: false; status: 404 | 410 };

/** Public token → booking. 404 unknown/rotated token; 410 once the stay is over / cancelled. */
export async function resolveGuestFormCompletion(token: string): Promise<CompletionResolution> {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return { ok: false, status: 404 };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('*')
    .eq('guest_form_token', trimmed)
    .maybeSingle();

  if (error) {
    console.error('[guestFormCompletion] resolve failed:', error.message);
    return { ok: false, status: 404 };
  }
  if (!data) return { ok: false, status: 404 };

  const booking = data as GuestSubmission;
  if (!isCompletionLinkLive(booking)) return { ok: false, status: 410 };

  const propertySlug = await resolvePropertySlugById(String(booking.property_id ?? ''));
  if (!propertySlug) return { ok: false, status: 404 };

  return { ok: true, booking, propertySlug };
}

/** Stamp `guest_form_completed_at` after a successful completion submit (idempotent-safe). */
export async function markGuestFormCompleted(bookingId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('guest_submissions')
    .update({ guest_form_completed_at: new Date().toISOString() })
    .eq('id', bookingId)
    .is('guest_form_completed_at', null);
  if (error) {
    console.error(
      '[guestFormCompletion] markGuestFormCompleted failed (non-fatal):',
      error.message
    );
  }
}
