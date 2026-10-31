/**
 * get-booking-ai-review — Polling endpoint for the booking AI review job row.
 *
 * Trigger: GET /functions/v1/get-booking-ai-review?property_id=<id>&bookingId=<id>
 * Auth:    resolveScopedPropertyAccess(req, 'bookings.detail.stay:edit')
 *
 * Completed/failed rows include `stale_sections`: section ids whose stored
 * fingerprint no longer matches the live booking (computed, not stored).
 */

import {
  failStaleStuckBookingAiReview,
  getBookingAiReviewById,
  withStaleAiReviewSections,
} from '../_shared/bookingAiReviewService.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-booking-ai-review', async (req) => {
  requireHttpMethod(req, 'GET');
  const { property } = await resolveScopedPropertyAccess(req, 'bookings.detail.stay:edit');
  const propertyId = property.id;

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId')?.trim();
  if (!bookingId) throw new Error('bookingId is required');

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  let row = await getBookingAiReviewById(bookingId);
  if (row) {
    row = await failStaleStuckBookingAiReview(row);
  }
  return jsonSuccess(req, await withStaleAiReviewSections(row, propertyId));
});
