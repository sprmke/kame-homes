/**
 * respond-to-host-review — guest's single public response to a published host review.
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { guestOwnsHostReview } from '../_shared/guestMyReviews.ts';
import { getHostGuestReviewRow, respondToHostReview } from '../_shared/hostGuestReviewService.ts';
import {
  normalizeReviewText,
  REVIEW_RESPONSE_MAX_LEN,
  validateReviewText,
} from '../_shared/reviewContentPolicy.ts';
import { logGuestActivity } from '../_shared/guestActivity.ts';
import { createNotification } from '../_shared/notificationService.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

serveAuthenticated('respond-to-host-review', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  if (!bookingId) return jsonError(req, 'bookingId is required', 400);

  const review = await getHostGuestReviewRow(bookingId);
  if (!review) return jsonError(req, 'Review not found', 404);
  const owned = await guestOwnsHostReview(user, review.id);
  if (!owned.ok) return jsonError(req, 'Review not found', 404);

  const responseText = normalizeReviewText(
    typeof body.responseText === 'string' ? body.responseText : null
  );
  const textErr = validateReviewText(responseText, {
    maxLen: REVIEW_RESPONSE_MAX_LEN,
    fieldLabel: 'Response',
  });
  if (textErr) return jsonError(req, textErr, 400);

  const result = await respondToHostReview(bookingId, responseText);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 409;
    return jsonError(req, 'This review cannot be responded to yet', status);
  }

  await logGuestActivity({
    req,
    action: responseText ? 'review.response_posted' : 'review.response_deleted',
    propertyId: owned.propertyId,
    guest: { email: user.email },
    targetId: bookingId,
    metadata: { deleted: !responseText, side: 'guest' },
  });

  if (responseText) {
    await createNotification({
      organizationId: owned.organizationId,
      propertyId: owned.propertyId,
      type: 'review_response_received',
      title: 'A guest responded to your review',
      bookingId,
      metadata: {},
      dedupeKey: `${bookingId}:review_response_received:guest`,
    });
    await capturePostHogEvent('review_response_posted', {
      logPrefix: 'respond-to-host-review',
      request: req,
      properties: { property_id: owned.propertyId, booking_id: bookingId, side: 'guest' },
    });
  }

  return jsonSuccess(req, { saved: true });
});
