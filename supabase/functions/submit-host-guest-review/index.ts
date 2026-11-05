/**
 * submit-host-guest-review — host writes/edits a review of the guest until publish.
 * Auth: reviews.guests:edit. N/A for plans (core trust, all tiers).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { guestIdentityKey } from '../_shared/guestIdentityKey.ts';
import { upsertHostGuestReview } from '../_shared/hostGuestReviewService.ts';
import {
  parseHostReviewTags,
  validateHostGuestReviewFields,
  validateHostReviewTags,
} from '../_shared/reviewCategories.ts';
import {
  normalizeReviewText,
  REVIEW_PRIVATE_NOTE_MAX_LEN,
  REVIEW_TEXT_MAX_LEN,
  validateReviewText,
} from '../_shared/reviewContentPolicy.ts';
import { hostCanReview } from '../_shared/reviewEligibility.ts';
import { ensureReviewWindow, getReviewWindow } from '../_shared/reviewWindow.ts';
import { publishIfComplete } from '../_shared/reviewPublishing.ts';
import { logActivity, buildActorContext } from '../_shared/activityLog.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

serveAuthenticated('submit-host-guest-review', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  let access;
  try {
    access = await resolveScopedPropertyAccess(req, 'reviews.guests:edit');
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  if (!bookingId) return jsonError(req, 'bookingId is required', 400);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return jsonError(req, 'Booking not found', 404);
  try {
    await verifyBookingBelongsToProperty(bookingId, access.property.id);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const reviewText = normalizeReviewText(
    typeof body.reviewText === 'string' ? body.reviewText : null
  );
  const fieldErr = validateHostGuestReviewFields({
    overallRating: body.overallRating,
    cleanlinessRating: body.cleanlinessRating,
    communicationRating: body.communicationRating,
    houseRulesRating: body.houseRulesRating,
    wouldHostAgain: body.wouldHostAgain,
    reviewText,
  });
  if (fieldErr) return jsonError(req, fieldErr, 400);

  const textErr = validateReviewText(reviewText, { maxLen: REVIEW_TEXT_MAX_LEN });
  if (textErr) return jsonError(req, textErr, 400);

  const privateNote = normalizeReviewText(
    typeof body.privateNote === 'string' ? body.privateNote : null
  );
  const noteErr = validateReviewText(privateNote, {
    maxLen: REVIEW_PRIVATE_NOTE_MAX_LEN,
    fieldLabel: 'Private note',
    allowContactInfo: true,
  });
  if (noteErr) return jsonError(req, noteErr, 400);

  const internalNote = normalizeReviewText(
    typeof body.internalNote === 'string' ? body.internalNote : null
  );
  const internalErr = validateReviewText(internalNote, {
    maxLen: REVIEW_PRIVATE_NOTE_MAX_LEN,
    fieldLabel: 'Team note',
    allowContactInfo: true,
  });
  if (internalErr) return jsonError(req, internalErr, 400);

  const overallRating = body.overallRating as number;
  const strengthTags = parseHostReviewTags(body.strengthTags);
  const issueTags = parseHostReviewTags(body.issueTags);
  const tags = overallRating >= 4 ? strengthTags : issueTags;
  const tagsErr = validateHostReviewTags(overallRating, tags);
  if (tagsErr) return jsonError(req, tagsErr, 400);

  let window = await getReviewWindow(bookingId);
  if (!hostCanReview(booking, window)) {
    return jsonError(req, 'Review is not available for this booking', 409);
  }

  await ensureReviewWindow({
    bookingId,
    propertyId: access.property.id,
    organizationId: access.property.organization_id,
    checkOutDate: String(booking.check_out_date ?? ''),
  });
  window = await getReviewWindow(bookingId);
  if (!hostCanReview(booking, window)) {
    return jsonError(req, 'Review is not available for this booking', 409);
  }

  const identityKey = await guestIdentityKey(
    (booking.guest_email as string | null) ?? null,
    bookingId
  );

  const result = await upsertHostGuestReview({
    bookingId,
    propertyId: access.property.id,
    organizationId: access.property.organization_id,
    guestUserId: (booking.guest_user_id as string | null) ?? null,
    guestIdentityKey: identityKey,
    overallRating,
    cleanlinessRating: body.cleanlinessRating as number,
    communicationRating: body.communicationRating as number,
    houseRulesRating: body.houseRulesRating as number,
    wouldHostAgain: body.wouldHostAgain as boolean,
    strengthTags: overallRating >= 4 ? tags : [],
    issueTags: overallRating >= 4 ? [] : tags,
    reviewText,
    privateNote,
    internalNote,
    authorUserId: access.user.id,
  });

  if (!result.ok) {
    return jsonError(
      req,
      'This review has already been published and can no longer be edited',
      409
    );
  }

  await publishIfComplete(bookingId);

  await logActivity({
    action: result.wasEdit ? 'review.host_edited' : 'review.host_submitted',
    organizationId: access.property.organization_id,
    propertyId: access.property.id,
    actor: buildActorContext('dashboard', { propertyAccess: access }, req),
    targetId: bookingId,
    targetLabel:
      (booking.primary_guest_name as string | null) ||
      (booking.guest_facebook_name as string | null) ||
      null,
    metadata: { overall_rating: overallRating, was_edit: result.wasEdit },
  });

  await capturePostHogEvent('host_guest_review_submitted', {
    logPrefix: 'submit-host-guest-review',
    request: req,
    properties: {
      property_id: access.property.id,
      booking_id: bookingId,
      overall_rating: overallRating,
      was_edit: result.wasEdit,
    },
  });

  return jsonSuccess(req, { submitted: true, wasEdit: result.wasEdit });
});
