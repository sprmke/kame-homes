/**
 * respond-to-guest-review — host's single public response to a published guest review.
 * Auth: reviews.responses:edit.
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
import { respondToGuestReview } from '../_shared/guestReviewService.ts';
import {
  normalizeReviewText,
  REVIEW_RESPONSE_MAX_LEN,
  validateReviewText,
} from '../_shared/reviewContentPolicy.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { sendReviewResponseEmail } from '../_shared/reviewEmails.ts';
import { DatabaseService } from '../_shared/databaseService.ts';

serveAuthenticated('respond-to-guest-review', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  let access;
  try {
    access = await resolveScopedPropertyAccess(req, 'reviews.responses:edit');
  } catch (err) {
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

  const responseText = normalizeReviewText(
    typeof body.responseText === 'string' ? body.responseText : null
  );
  const textErr = validateReviewText(responseText, {
    maxLen: REVIEW_RESPONSE_MAX_LEN,
    fieldLabel: 'Response',
  });
  if (textErr) return jsonError(req, textErr, 400);

  const result = await respondToGuestReview(bookingId, responseText, access.user.id);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 409;
    return jsonError(req, 'This review cannot be responded to yet', status);
  }

  await logActivity({
    action: responseText ? 'review.response_posted' : 'review.response_deleted',
    organizationId: access.property.organization_id,
    propertyId: access.property.id,
    actor: buildActorContext('dashboard', { propertyAccess: access }, req),
    targetId: bookingId,
    metadata: { deleted: !responseText },
  });

  if (responseText) {
    await capturePostHogEvent('review_response_posted', {
      logPrefix: 'respond-to-guest-review',
      request: req,
      properties: {
        property_id: access.property.id,
        booking_id: bookingId,
        first_response: result.firstResponse,
      },
    });
  }

  // Email the guest once, when the response first appears. Edits stay silent.
  if (result.firstResponse) {
    const booking = await DatabaseService.getBookingById(bookingId);
    if (booking) {
      const guestName =
        (booking.primary_guest_name as string | null) ||
        (booking.guest_facebook_name as string | null) ||
        'there';
      await sendReviewResponseEmail({
        bookingId,
        propertyId: access.property.id,
        guestEmail: (booking.guest_email as string | null) ?? null,
        guestName,
      });
    }
  }

  return jsonSuccess(req, { saved: true });
});
