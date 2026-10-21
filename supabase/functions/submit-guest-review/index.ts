/**
 * submit-guest-review — Public POST for the guest's stay review.
 * multipart/form-data: bookingId, starRating, categoryRatings (JSON, all 6
 * required — D9), reviewText (optional, public), privateNote (optional,
 * host-only), feedbackTags JSON (optional), media files (optional).
 *
 * Editable until published (double-blind, see `booking_review_windows`):
 * resubmitting before the window resolves edits the draft in place. Reached
 * from the SD-refund embedded step and the standalone `/guest-review` page —
 * both use `SdFormReviewSection`.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { resolveGuestReviewPath } from '../_shared/guestReviewEligibility.ts';
import { guestCanReview } from '../_shared/reviewEligibility.ts';
import { ensureReviewWindow, getReviewWindow } from '../_shared/reviewWindow.ts';
import { publishIfComplete } from '../_shared/reviewPublishing.ts';
import {
  parseGuestCategoryRatingsFromFormValue,
  validateGuestCategoryRatings,
} from '../_shared/reviewCategories.ts';
import {
  normalizeReviewText,
  REVIEW_PRIVATE_NOTE_MAX_LEN,
  REVIEW_TEXT_MAX_LEN,
  validateReviewText,
} from '../_shared/reviewContentPolicy.ts';
import {
  getGuestReviewRow,
  uploadGuestReviewMedia,
  upsertGuestReview,
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

async function resolveOrganizationId(propertyId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
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
  const privateNoteRaw = (form.get('privateNote')?.toString() ?? '').trim() || null;
  const categoryRatings = parseGuestCategoryRatingsFromFormValue(form.get('categoryRatings'));
  const feedbackTags = parseGuestReviewFeedbackTags(form.get('feedbackTags'));

  if (!bookingId) return jsonError(req, 'bookingId is required', 400);
  if (starRating == null) return jsonError(req, 'starRating must be 1–5', 400);

  const categoryErr = validateGuestCategoryRatings(categoryRatings);
  if (categoryErr) return jsonError(req, categoryErr, 400);

  const textErr = validateReviewText(reviewText, { maxLen: REVIEW_TEXT_MAX_LEN });
  if (textErr) return jsonError(req, textErr, 400);

  const noteErr = validateReviewText(privateNoteRaw, {
    maxLen: REVIEW_PRIVATE_NOTE_MAX_LEN,
    fieldLabel: 'Private note',
    allowContactInfo: true,
  });
  if (noteErr) return jsonError(req, noteErr, 400);

  const tagsErr = validateGuestReviewFeedbackTags(starRating, feedbackTags);
  if (tagsErr) return jsonError(req, tagsErr, 400);

  const mediaFiles = form
    .getAll('media')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const mediaErr = validateGuestReviewMedia(mediaFiles);
  if (mediaErr) return jsonError(req, mediaErr, 400);

  const row = await DatabaseService.getBookingById(bookingId);
  const authz = await authorizeGuestBookingAccess({
    bookingIdFromPath: bookingId,
    accessTokenFromQuery: guestBookingAccessTokenFromRequest(req, form),
    bookingCreatedAt: (row?.created_at as string | null | undefined) ?? null,
  });
  if (!authz.ok) return jsonError(req, authz.message, authz.status);
  if (!row) return jsonError(req, 'Booking not found', 404);

  const propertyId = (row.property_id as string | null | undefined) ?? null;
  if (!propertyId || row.parking_id) {
    return jsonError(req, 'Review is not available for this booking', 409);
  }

  const window = await getReviewWindow(bookingId);
  if (!guestCanReview(row, window)) {
    return jsonError(req, 'Review is not available for this booking', 409);
  }

  const organizationId = await resolveOrganizationId(propertyId);
  if (!organizationId) return jsonError(req, 'Organization not found for booking', 400);

  await ensureReviewWindow({
    bookingId,
    propertyId,
    organizationId,
    checkOutDate: (row.check_out_date as string | null) ?? '',
  });

  const existingReview = mediaFiles.length === 0 ? await getGuestReviewRow(bookingId) : null;
  const mediaUrls =
    mediaFiles.length > 0
      ? await uploadGuestReviewMedia(bookingId, propertyId, mediaFiles)
      : (existingReview?.media_urls ?? []);

  const guestDisplayName =
    (row.primary_guest_name as string | null)?.trim() ||
    (row.guest_facebook_name as string | null)?.trim() ||
    null;

  const source = resolveGuestReviewPath(row) === 'sd_refund' ? 'sd_form' : 'guest_review';

  const result = await upsertGuestReview({
    propertyId,
    organizationId,
    bookingId,
    guestUserId: (row.guest_user_id as string | null) ?? null,
    starRating,
    reviewText: normalizeReviewText(reviewText),
    categoryRatings,
    privateNote: normalizeReviewText(privateNoteRaw),
    feedbackTags,
    mediaUrls,
    guestDisplayName,
    source,
  });

  if (!result.ok) {
    return jsonError(
      req,
      'This review has already been published and can no longer be edited',
      409
    );
  }

  await publishIfComplete(bookingId);

  await logGuestActivity({
    req,
    action: 'guest.review_submitted',
    propertyId,
    guest: { name: guestDisplayName },
    targetId: bookingId,
    targetLabel: guestDisplayName,
    metadata: {
      star_rating: starRating,
      has_media: mediaUrls.length > 0,
      was_edit: result.wasEdit,
    },
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
      was_edit: result.wasEdit,
    },
  });

  return jsonSuccess(req, { submitted: true, wasEdit: result.wasEdit });
});
