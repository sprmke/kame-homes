/**
 * submit-guest-review — Public POST for in-app SD refund review step.
 * multipart/form-data: bookingId, starRating, reviewText (optional), feedbackTags JSON (optional), media files (optional).
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { canAccessGuestReview } from '../_shared/guestReviewEligibility.ts';
import {
  guestReviewExistsForBooking,
  insertGuestReview,
  uploadGuestReviewMedia,
  validateGuestReviewMedia,
} from '../_shared/guestReviewService.ts';
import {
  parseGuestReviewFeedbackTags,
  validateGuestReviewFeedbackTags,
} from '../_shared/guestReviewFeedbackTags.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { logGuestActivity } from '../_shared/guestActivity.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { maintenanceModeResponse } from '../_shared/platformSettingsCache.ts';
import {
  authorizeGuestBookingAccess,
  guestBookingAccessTokenFromRequest,
} from '../_shared/guestBookingAccessToken.ts';

function parseStarRating(raw: FormDataEntryValue | null): number | null {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

servePublic('submit-guest-review', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const maintenance = await maintenanceModeResponse(req);
  if (maintenance) return maintenance;

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonError(req, 'Expected multipart/form-data', 400);
  }

  const form = await req.formData();

  // Anti-spam: bot heuristics → Turnstile → durable rate limit.
  // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
  const antiSpamBlocked = await antiSpamGate(req, form, {
    scope: 'submit-guest-review',
    rateLimit: { limit: 10, windowSec: 60 },
  });
  if (antiSpamBlocked) return antiSpamBlocked;

  const bookingId = (form.get('bookingId')?.toString() ?? '').trim();
  const starRating = parseStarRating(form.get('starRating'));
  const reviewText = (form.get('reviewText')?.toString() ?? '').trim() || null;
  const feedbackTags = parseGuestReviewFeedbackTags(form.get('feedbackTags'));

  if (!bookingId) return jsonError(req, 'bookingId is required', 400);
  if (starRating == null) return jsonError(req, 'starRating must be 1–5', 400);

  const tagsErr = validateGuestReviewFeedbackTags(starRating, feedbackTags);
  if (tagsErr) return jsonError(req, tagsErr, 400);

  const mediaFiles = form
    .getAll('media')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const mediaErr = validateGuestReviewMedia(mediaFiles);
  if (mediaErr) return jsonError(req, mediaErr, 400);

  if (await guestReviewExistsForBooking(bookingId)) {
    return jsonSuccess(req, { alreadySubmitted: true });
  }

  const row = await DatabaseService.getBookingById(bookingId);
  const authz = await authorizeGuestBookingAccess({
    bookingIdFromPath: bookingId,
    accessTokenFromQuery: guestBookingAccessTokenFromRequest(req, form),
    bookingCreatedAt: (row?.created_at as string | null | undefined) ?? null,
  });
  if (!authz.ok) return jsonError(req, authz.message, authz.status);
  if (!row) return jsonError(req, 'Booking not found', 404);

  if (!canAccessGuestReview(row)) {
    return jsonError(req, 'Review is not available for this booking', 409);
  }

  const propertyId = (row.property_id as string | null | undefined) ?? null;
  if (!propertyId) return jsonError(req, 'Property not found for booking', 400);

  const mediaUrls =
    mediaFiles.length > 0 ? await uploadGuestReviewMedia(bookingId, propertyId, mediaFiles) : [];

  const guestDisplayName =
    (row.primary_guest_name as string | null)?.trim() ||
    (row.guest_facebook_name as string | null)?.trim() ||
    null;

  await insertGuestReview({
    propertyId,
    bookingId,
    starRating,
    reviewText,
    feedbackTags,
    mediaUrls,
    guestDisplayName,
  });

  await logGuestActivity({
    req,
    action: 'guest.review_submitted',
    propertyId,
    guest: { name: guestDisplayName },
    targetId: bookingId,
    targetLabel: guestDisplayName,
    metadata: { star_rating: starRating, has_media: mediaUrls.length > 0 },
  });

  await capturePostHogEvent('guest_review_submitted', {
    logPrefix: 'submit-guest-review',
    request: req,
    properties: {
      property_id: propertyId,
      booking_id: bookingId,
      star_rating: starRating,
      feedback_tag_count: feedbackTags.length,
      media_count: mediaUrls.length,
    },
  });

  return jsonSuccess(req, { submitted: true });
});
