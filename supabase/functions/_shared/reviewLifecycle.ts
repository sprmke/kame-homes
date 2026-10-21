/**
 * Review-window lifecycle sweep: expire closed windows, send request/reminder
 * emails once, host `review_due` bell once. Called by `review-lifecycle-cron`.
 *
 * Counts are kept per organization so the cron writes one `system.cron_run`
 * row only for orgs where something happened, with that org's own numbers.
 */

import { createServiceClient } from './orgAuth.ts';
import { createNotification } from './notificationService.ts';
import { guestReviewExistsForBooking } from './guestReviewService.ts';
import { getHostGuestReviewRow } from './hostGuestReviewService.ts';
import { sendReviewReminderEmail, sendReviewRequestEmail } from './reviewEmails.ts';
import { publishExpired } from './reviewPublishing.ts';
import { propertyAutomationEnabled } from './propertyAutomationToggles.ts';
import type { ReviewWindowRow } from './reviewWindow.ts';
import { computeReviewWindow, ensureReviewWindow } from './reviewWindow.ts';
import { DatabaseService } from './databaseService.ts';
import { runAutoReviews } from './reviewAutomation.ts';

const REMINDER_DAYS = 3;
const FALLBACK_LOOKBACK_DAYS = 14;
/** Keyset page over open windows; MAX_WINDOW_PAGES bounds one run's work. */
const WINDOW_PAGE_SIZE = 200;
const MAX_WINDOW_PAGES = 10;

const WINDOW_COLUMNS =
  'booking_id, property_id, organization_id, opens_at, closes_at, published_at, guest_request_sent_at, guest_reminder_sent_at, host_reminder_notified_at, closed_reason, auto_review_paused';

function daysUntil(iso: string, now = new Date()): number {
  return (Date.parse(iso) - now.getTime()) / 86_400_000;
}

export type ReviewLifecycleCounts = {
  published: number;
  cancelled: number;
  requestsSent: number;
  remindersSent: number;
  hostDueNotified: number;
  windowsEnsured: number;
  autoReviewsSubmitted: number;
  autoReviewsSkipped: number;
};

export type ReviewLifecycleStats = ReviewLifecycleCounts & {
  scanned: number;
  /** Only organizations with at least one non-zero count. */
  byOrganization: Record<string, ReviewLifecycleCounts>;
};

function emptyCounts(): ReviewLifecycleCounts {
  return {
    published: 0,
    cancelled: 0,
    requestsSent: 0,
    remindersSent: 0,
    hostDueNotified: 0,
    windowsEnsured: 0,
    autoReviewsSubmitted: 0,
    autoReviewsSkipped: 0,
  };
}

async function markWindow(bookingId: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('booking_review_windows')
    .update(patch)
    .eq('booking_id', bookingId);
  if (error) console.error('[reviewLifecycle] markWindow failed:', bookingId, error.message);
}

export async function runReviewLifecycle(now = new Date()): Promise<ReviewLifecycleStats> {
  const stats: ReviewLifecycleStats = { ...emptyCounts(), scanned: 0, byOrganization: {} };
  const bump = (organizationId: string | null | undefined, key: keyof ReviewLifecycleCounts) => {
    stats[key] += 1;
    if (!organizationId) return;
    const org = (stats.byOrganization[organizationId] ??= emptyCounts());
    org[key] += 1;
  };

  const supabase = createServiceClient();
  let afterBookingId: string | null = null;
  for (let page = 0; page < MAX_WINDOW_PAGES; page++) {
    let query = supabase
      .from('booking_review_windows')
      .select(WINDOW_COLUMNS)
      .is('published_at', null)
      .order('booking_id', { ascending: true })
      .limit(WINDOW_PAGE_SIZE);
    if (afterBookingId) query = query.gt('booking_id', afterBookingId);
    const { data: openWindows, error } = await query;
    if (error) {
      console.error('[reviewLifecycle] list open windows failed:', error.message);
      break;
    }
    const windows = (openWindows ?? []) as ReviewWindowRow[];
    stats.scanned += windows.length;
    for (const window of windows) {
      await processWindow(window, now, bump);
    }
    if (windows.length < WINDOW_PAGE_SIZE) break;
    afterBookingId = windows[windows.length - 1]?.booking_id ?? null;
  }

  // Fallback: bookings that reached check-out in the last 14 days without a window.
  const lookback = new Date(now.getTime() - FALLBACK_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data: recent } = await supabase
    .from('guest_submissions')
    .select('id, property_id, check_out_date, status')
    .in('status', ['READY_FOR_CHECKOUT', 'PENDING_SD_REFUND', 'COMPLETED'])
    .is('parking_id', null)
    .gte('updated_at', lookback)
    .order('updated_at', { ascending: false })
    .limit(200);
  for (const row of recent ?? []) {
    const propertyId = row.property_id as string | null;
    if (!propertyId) continue;
    const { closesAt } = computeReviewWindow(String(row.check_out_date ?? ''), now.toISOString());
    if (Date.parse(closesAt) < now.getTime()) continue;
    const { data: existing } = await supabase
      .from('booking_review_windows')
      .select('booking_id')
      .eq('booking_id', row.id)
      .maybeSingle();
    if (existing?.booking_id) continue;
    const { data: property } = await supabase
      .from('properties')
      .select('organization_id')
      .eq('id', propertyId)
      .maybeSingle();
    const organizationId = property?.organization_id as string | undefined;
    if (!organizationId) continue;
    await ensureReviewWindow({
      bookingId: row.id as string,
      propertyId,
      organizationId,
      checkOutDate: String(row.check_out_date ?? ''),
    });
    bump(organizationId, 'windowsEnsured');
  }

  await runAutoReviews(now, (organizationId, outcome) =>
    bump(organizationId, outcome === 'submitted' ? 'autoReviewsSubmitted' : 'autoReviewsSkipped')
  );

  return stats;
}

async function processWindow(
  window: ReviewWindowRow,
  now: Date,
  bump: (organizationId: string, key: keyof ReviewLifecycleCounts) => void
): Promise<void> {
  const orgId = window.organization_id;
  try {
    const booking = await DatabaseService.getBookingById(window.booking_id);
    if (!booking) return;
    if (String(booking.status ?? '') === 'CANCELLED') {
      await markWindow(window.booking_id, {
        published_at: now.toISOString(),
        closed_reason: 'cancelled',
      });
      bump(orgId, 'cancelled');
      return;
    }

    if (now.getTime() > Date.parse(window.closes_at)) {
      const result = await publishExpired(window.booking_id);
      if (result.ok && !result.alreadyResolved) bump(orgId, 'published');
      return;
    }

    const guestEmail = (booking.guest_email as string | null)?.trim() || null;
    const guestName =
      (booking.primary_guest_name as string | null)?.trim() ||
      (booking.guest_facebook_name as string | null)?.trim() ||
      'there';
    // The SD refund email already asks for the review (step 1 of that form).
    const sdEmailed =
      typeof booking.sd_refund_form_emailed_at === 'string' &&
      booking.sd_refund_form_emailed_at.trim() !== '';
    const daysLeft = daysUntil(window.closes_at, now);
    const inReminderWindow = daysLeft > 0 && daysLeft <= REMINDER_DAYS;
    const wantsRequest = Boolean(guestEmail) && !window.guest_request_sent_at && !sdEmailed;
    const wantsReminder = Boolean(guestEmail) && inReminderWindow && !window.guest_reminder_sent_at;
    const guestSubmitted =
      wantsRequest || wantsReminder ? await guestReviewExistsForBooking(window.booking_id) : false;

    if (wantsRequest && guestEmail && !guestSubmitted) {
      const allowed = await propertyAutomationEnabled(window.property_id, 'emailReviewRequest');
      const sent = allowed
        ? await sendReviewRequestEmail({
            bookingId: window.booking_id,
            propertyId: window.property_id,
            guestEmail,
            guestName,
          })
        : false;
      // Mark when disabled too, so turning the toggle on later never back-fills old stays.
      if (sent || !allowed) {
        await markWindow(window.booking_id, { guest_request_sent_at: now.toISOString() });
      }
      if (sent) bump(orgId, 'requestsSent');
    }

    if (!inReminderWindow) return;

    if (wantsReminder && guestEmail && !guestSubmitted) {
      const allowed = await propertyAutomationEnabled(window.property_id, 'emailReviewReminder');
      const sent = allowed
        ? await sendReviewReminderEmail({
            bookingId: window.booking_id,
            propertyId: window.property_id,
            guestEmail,
            guestName,
          })
        : false;
      if (sent || !allowed) {
        await markWindow(window.booking_id, { guest_reminder_sent_at: now.toISOString() });
      }
      if (sent) bump(orgId, 'remindersSent');
    }

    if (!window.host_reminder_notified_at) {
      const hostReview = await getHostGuestReviewRow(window.booking_id);
      if (!hostReview) {
        await createNotification({
          organizationId: window.organization_id,
          propertyId: window.property_id,
          type: 'review_due',
          title: `Review ${guestName}`,
          bookingId: window.booking_id,
          metadata: { guest_name: guestName },
          dedupeKey: `${window.booking_id}:review_due`,
        });
        await markWindow(window.booking_id, { host_reminder_notified_at: now.toISOString() });
        bump(orgId, 'hostDueNotified');
      }
    }
  } catch (err) {
    console.error('[reviewLifecycle] window failed:', window.booking_id, err);
  }
}
