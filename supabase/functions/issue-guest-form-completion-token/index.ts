/**
 * issue-guest-form-completion-token — host mints the guest-form completion link for an
 * OTA-ingested booking (calendar sync Phase 2, §6.5).
 *
 * POST { bookingId }
 *   → { bookingId, guestFormToken, completionUrl }
 *
 * Booking must belong to the caller's property, be OTA-sourced (external_source set, or
 * booking_source='Airbnb'), still be PENDING_REVIEW, and its check-out must not be past.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { issueGuestFormCompletionToken } from '../_shared/guestFormCompletion.ts';
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

const REASON_MESSAGE: Record<string, { message: string; status: number }> = {
  not_external: { message: 'This booking did not come from an OTA calendar sync', status: 409 },
  wrong_status: {
    message: 'The guest-form link is only available while the booking is pending review',
    status: 409,
  },
  link_expired: { message: 'This stay has already ended', status: 410 },
  invalid_booking: { message: 'Booking is missing a property', status: 409 },
};

serveAuthenticated('issue-guest-form-completion-token', async (req) => {
  requireHttpMethod(req, 'POST');
  const { property } = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');

  const body = await readJsonBody(req);
  const bookingId = body?.bookingId;
  if (!bookingId || typeof bookingId !== 'string') {
    return jsonError(req, 'bookingId (string) is required');
  }

  await verifyBookingBelongsToProperty(bookingId, property.id);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return jsonError(req, 'Booking not found', 404);

  const issued = await issueGuestFormCompletionToken(booking as GuestSubmission);
  if (!issued.ok) {
    const mapped = REASON_MESSAGE[issued.reason] ?? {
      message: 'Guest-form link is not available for this booking',
      status: 409,
    };
    return jsonError(req, mapped.message, mapped.status);
  }

  return jsonSuccess(req, {
    bookingId,
    guestFormToken: issued.token,
    completionUrl: issued.url,
  });
});
