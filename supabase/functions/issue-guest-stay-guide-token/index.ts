/**
 * issue-guest-stay-guide-token — Admin-only: create or refresh guest stay guide link.
 *
 * POST { bookingId }
 * Plan: `propertyShowcase` (Pro+) → 402 upgradeHook otherwise.
 * Booking must be READY_FOR_CHECKIN, READY_FOR_CHECKOUT, PENDING_SD_REFUND, or COMPLETED.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { issueGuestStayGuideAccess } from '../_shared/guestStayGuide.ts';
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
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import type { GuestSubmission } from '../_shared/types.ts';

serveAuthenticated('issue-guest-stay-guide-token', async (req) => {
  requireHttpMethod(req, 'POST');
  const { property } = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const propertyId = property.id;
  try {
    await requirePropertyFeature(propertyId, 'propertyShowcase');
  } catch (err) {
    const planErr = catchPlanFeatureError(req, err);
    if (planErr) return planErr;
    throw err;
  }
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

  const issued = await issueGuestStayGuideAccess(booking as GuestSubmission);
  if (!issued) {
    return jsonError(req, `Stay guide link is not available for status ${booking.status}`, 409);
  }

  return jsonSuccess(req, {
    bookingId,
    stayGuideToken: issued.token,
    stayGuideUrl: issued.url,
    validUntil: issued.validUntil,
  });
});
