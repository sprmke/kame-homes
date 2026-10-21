/**
 * Review window — the 14-day double-blind state machine anchor (D1).
 * One row per eligible booking in `booking_review_windows`.
 */

import { createServiceClient } from './orgAuth.ts';
import { normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';

export const REVIEW_WINDOW_DAYS = 14;

export type ReviewWindowRow = {
  booking_id: string;
  property_id: string;
  organization_id: string;
  opens_at: string;
  closes_at: string;
  published_at: string | null;
  guest_request_sent_at: string | null;
  guest_reminder_sent_at: string | null;
  host_reminder_notified_at: string | null;
  closed_reason: 'published' | 'expired' | 'cancelled' | null;
  auto_review_paused?: boolean;
};

/** Opens at check-out (00:00 Manila) or now, whichever is first; closes 14 days later, end of day Manila. */
export function computeReviewWindow(
  checkOutDate: string,
  nowIso = new Date().toISOString()
): {
  opensAt: string;
  closesAt: string;
} {
  const checkOutYmd = normalizeBookingDateToYmd(checkOutDate);
  const checkOutMidnightManila = checkOutYmd ? `${checkOutYmd}T00:00:00+08:00` : nowIso;
  const opensAtMs = Math.min(Date.parse(checkOutMidnightManila), Date.parse(nowIso));
  const opensAt = new Date(opensAtMs).toISOString();

  const opensYmd = checkOutYmd ?? opensAt.slice(0, 10);
  const [y, m, d] = opensYmd.split('-').map(Number);
  const closesDate = new Date(Date.UTC(y, m - 1, d + REVIEW_WINDOW_DAYS));
  const closesYmd = closesDate.toISOString().slice(0, 10);
  const closesAt = `${closesYmd}T23:59:59+08:00`;

  return { opensAt, closesAt: new Date(closesAt).toISOString() };
}

export function isWindowOpen(
  window: Pick<ReviewWindowRow, 'closes_at' | 'published_at'>,
  now = new Date()
): boolean {
  if (window.published_at) return false;
  return now.getTime() <= Date.parse(window.closes_at);
}

/**
 * Idempotent upsert — creates the window the first time a booking becomes
 * review-eligible (orchestrator side effect + cron fallback). Never overwrites
 * an existing window's dates once created.
 */
export async function ensureReviewWindow(input: {
  bookingId: string;
  propertyId: string;
  organizationId: string;
  checkOutDate: string;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from('booking_review_windows')
      .select('booking_id')
      .eq('booking_id', input.bookingId)
      .maybeSingle();
    if (existing?.booking_id) return;

    const { opensAt, closesAt } = computeReviewWindow(input.checkOutDate);
    const { error } = await supabase.from('booking_review_windows').insert({
      booking_id: input.bookingId,
      property_id: input.propertyId,
      organization_id: input.organizationId,
      opens_at: opensAt,
      closes_at: closesAt,
    });
    if (error && error.code !== '23505') {
      console.error('[reviewWindow] ensureReviewWindow insert failed:', error.message);
    }
  } catch (err) {
    console.error('[reviewWindow] ensureReviewWindow threw:', err);
  }
}

export async function getReviewWindow(bookingId: string): Promise<ReviewWindowRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_review_windows')
    .select(
      'booking_id, property_id, organization_id, opens_at, closes_at, published_at, guest_request_sent_at, guest_reminder_sent_at, host_reminder_notified_at, closed_reason, auto_review_paused'
    )
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) {
    console.warn('[reviewWindow] getReviewWindow failed:', error.message);
    return null;
  }
  return (data as ReviewWindowRow) ?? null;
}
