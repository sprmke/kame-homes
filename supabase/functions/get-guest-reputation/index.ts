/**
 * get-guest-reputation — host screening + current-booking review state.
 * Auth: bookings:view. Cross-org recent reviews omit internal notes. The
 * current booking's internal note is returned only to this property's team.
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { guestIdentityKey } from '../_shared/guestIdentityKey.ts';
import {
  getGuestReputation,
  getHostGuestReviewRow,
  listRecentPublishedHostReviewsForGuest,
} from '../_shared/hostGuestReviewService.ts';
import { hostCanReview } from '../_shared/reviewEligibility.ts';
import { getReviewWindow } from '../_shared/reviewWindow.ts';

serveAuthenticated('get-guest-reputation', async (req) => {
  requireHttpMethod(req, 'GET');

  let propertyId: string;
  try {
    const ctx = await resolveScopedPropertyAccess(req, 'bookings:view');
    propertyId = ctx.property.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const url = new URL(req.url);
  const bookingId = (url.searchParams.get('bookingId') ?? '').trim();
  if (!bookingId) return jsonError(req, 'bookingId is required', 400);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return jsonError(req, 'Booking not found', 404);
  try {
    await verifyBookingBelongsToProperty(bookingId, propertyId);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const email = (booking.guest_email as string | null)?.trim() || null;
  const guestUserId = (booking.guest_user_id as string | null) ?? null;
  const identityKey = email ? await guestIdentityKey(email, bookingId) : null;
  const lookupKey = identityKey && !identityKey.startsWith('booking:') ? identityKey : null;

  const [reputation, recent, hostReview, window] = await Promise.all([
    getGuestReputation(guestUserId, lookupKey),
    listRecentPublishedHostReviewsForGuest(guestUserId, lookupKey, bookingId, 5),
    getHostGuestReviewRow(bookingId),
    getReviewWindow(bookingId),
  ]);

  return jsonSuccess(req, {
    hasIdentity: Boolean(email || guestUserId),
    reputation,
    recentReviews: recent,
    hostReview: hostReview
      ? {
          status: hostReview.status,
          overallRating: hostReview.overall_rating,
          cleanlinessRating: hostReview.cleanliness_rating,
          communicationRating: hostReview.communication_rating,
          houseRulesRating: hostReview.house_rules_rating,
          wouldHostAgain: hostReview.would_host_again,
          strengthTags: hostReview.strength_tags,
          issueTags: hostReview.issue_tags,
          reviewText: hostReview.review_text,
          privateNote: hostReview.private_note,
          internalNote: hostReview.internal_note,
          publishedAt: hostReview.published_at,
        }
      : null,
    window: window
      ? {
          closesAt: window.closes_at,
          publishedAt: window.published_at,
          closedReason: window.closed_reason,
          autoReviewPaused: window.auto_review_paused === true,
        }
      : null,
    canHostReview: hostCanReview(booking, window),
  });
});
