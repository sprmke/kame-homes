/**
 * Double-blind publish — wraps the `publish_booking_reviews` SQL function
 * (atomic, row-locked). Call after any guest or host review write, and from
 * the review-lifecycle cron at window close (`p_force = true`).
 */

import { createServiceClient } from './orgAuth.ts';
import { createNotification } from './notificationService.ts';
import { sendReviewPublishedEmail } from './reviewEmails.ts';
import { DatabaseService } from './databaseService.ts';
import { capturePostHogEvent } from './posthog.ts';

export type PublishResult = {
  ok: boolean;
  alreadyResolved?: boolean;
  guestPublished?: boolean;
  hostPublished?: boolean;
  guestPending?: boolean;
  hostPending?: boolean;
  windowClosed?: boolean;
  reason?: string;
};

async function notifyPublishOutcome(bookingId: string, result: PublishResult): Promise<void> {
  if (result.alreadyResolved) return;
  if (!result.guestPublished && !result.hostPublished) return;

  try {
    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking) return;
    const propertyId = (booking.property_id as string | null) ?? null;
    if (!propertyId) return;
    const supabase = createServiceClient();
    const { data: property } = await supabase
      .from('properties')
      .select('organization_id')
      .eq('id', propertyId)
      .maybeSingle();
    const organizationId = property?.organization_id as string | undefined;
    if (!organizationId) return;

    const guestName =
      (booking.primary_guest_name as string | null) ||
      (booking.guest_facebook_name as string | null) ||
      'Guest';

    if (result.guestPublished) {
      // Guest's review of the property/host is now visible to the host.
      await createNotification({
        organizationId,
        propertyId,
        type: 'review_received',
        title: `${guestName} left a review`,
        bookingId,
        metadata: { guest_name: guestName },
        dedupeKey: `${bookingId}:review_received:guest`,
      });
    }

    await sendReviewPublishedEmail({
      bookingId,
      propertyId,
      guestEmail: (booking.guest_email as string | null) ?? null,
      guestName,
      hostReviewed: Boolean(result.hostPublished),
    });

    if (result.guestPublished || result.hostPublished) {
      await capturePostHogEvent('review_pair_published', {
        logPrefix: 'reviewPublishing',
        system: true,
        properties: {
          booking_id: bookingId,
          property_id: propertyId,
          trigger: result.windowClosed ? 'expired' : 'both',
          guest_published: Boolean(result.guestPublished),
          host_published: Boolean(result.hostPublished),
        },
      });
    }
  } catch (err) {
    console.error('[reviewPublishing] notifyPublishOutcome failed (non-fatal):', err);
  }
}

/** Call after a guest or host submits/edits their review. No-op unless both sides are now ready. */
export async function publishIfComplete(bookingId: string): Promise<PublishResult> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('publish_booking_reviews', {
      p_booking_id: bookingId,
      p_force: false,
    });
    if (error) {
      console.error('[reviewPublishing] publishIfComplete RPC failed:', error.message);
      return { ok: false, reason: error.message };
    }
    const result = (data as PublishResult) ?? { ok: false };
    await notifyPublishOutcome(bookingId, result);
    return result;
  } catch (err) {
    console.error('[reviewPublishing] publishIfComplete threw:', err);
    return { ok: false, reason: 'unexpected_error' };
  }
}

/** Cron-only: force-publish whichever side exists and close the window. */
export async function publishExpired(bookingId: string): Promise<PublishResult> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('publish_booking_reviews', {
      p_booking_id: bookingId,
      p_force: true,
    });
    if (error) {
      console.error('[reviewPublishing] publishExpired RPC failed:', error.message);
      return { ok: false, reason: error.message };
    }
    const result = (data as PublishResult) ?? { ok: false };
    await notifyPublishOutcome(bookingId, result);
    return result;
  } catch (err) {
    console.error('[reviewPublishing] publishExpired threw:', err);
    return { ok: false, reason: 'unexpected_error' };
  }
}
