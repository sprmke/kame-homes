/**
 * draft-review-with-ai — editable AI draft for a host-of-guest review or public response.
 * Never posts. Plan: reviewAutomation (Pro+). Credits via AI gateway.
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { aiErrorResponse } from '../_shared/ai/aiErrorResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { draftReviewWithAi } from '../_shared/reviewDraftAi.ts';
import { getGuestReviewRow } from '../_shared/guestReviewService.ts';

serveAuthenticated('draft-review-with-ai', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const kind = body.kind === 'guest_response' ? 'guest_response' : 'host_review';
  const leaf = kind === 'guest_response' ? 'reviews.responses:edit' : 'reviews.guests:edit';

  let access;
  try {
    access = await resolveScopedPropertyAccess(req, leaf);
    await requirePropertyFeature(access.property.id, 'reviewAutomation');
  } catch (err) {
    const planErr = catchPlanFeatureError(req, err);
    if (planErr) return planErr;
    if (err instanceof Response) return err;
    throw err;
  }

  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  if (!bookingId) return jsonError(req, 'bookingId is required', 400);
  try {
    await verifyBookingBelongsToProperty(bookingId, access.property.id);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  let guestReviewText: string | null = null;
  let guestRating: number | null = null;
  if (kind === 'guest_response') {
    const guestReview = await getGuestReviewRow(bookingId);
    if (!guestReview || guestReview.status !== 'published') {
      return jsonError(req, 'Guest review is not published yet', 409);
    }
    guestReviewText = guestReview.review_text;
    guestRating = guestReview.star_rating;
  }

  try {
    const text = await draftReviewWithAi({
      kind,
      organizationId: access.property.organization_id,
      propertyId: access.property.id,
      bookingId,
      actorUserId: access.user.id,
      guestReviewText,
      guestRating,
    });
    return jsonSuccess(req, { text });
  } catch (err) {
    return aiErrorResponse(req, err, 'draft-review-with-ai');
  }
});
