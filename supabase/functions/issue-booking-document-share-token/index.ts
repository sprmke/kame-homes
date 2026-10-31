/**
 * issue-booking-document-share-token — Admin-only: create (or reuse) the durable
 * share token that unlocks a booking's approved GAF / Pet PDFs for a guest link.
 *
 * POST { bookingId }
 */

import { ensureBookingDocumentShareToken } from '../_shared/bookingDocumentShareToken.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
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
import type { GuestSubmission } from '../_shared/types.ts';

serveAuthenticated('issue-booking-document-share-token', async (req) => {
  requireHttpMethod(req, 'POST');
  const { property } = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const propertyId = property.id;
  const body = await readJsonBody(req);
  const bookingId = body?.bookingId;
  if (!bookingId || typeof bookingId !== 'string') {
    return jsonError(req, 'bookingId (string) is required');
  }

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) {
    return jsonError(req, 'Booking not found', 404);
  }

  const token = await ensureBookingDocumentShareToken(booking as GuestSubmission);
  if (!token) {
    return jsonError(req, 'Document share link is not available for this booking', 409);
  }

  return jsonSuccess(req, { bookingId, documentShareToken: token });
});
