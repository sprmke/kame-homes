/**
 * send-booking-workflow-email — Admin manual (re-)send of a booking workflow email.
 *
 * POST { bookingId: string, kind: BookingWorkflowEmailKind }
 *
 * Escape hatch when `automatedBookingFlow` skips auto-send (Free) or a send failed.
 * Uses `rawPropertyAutomationEnabled` — never the plan gate.
 * Does not change booking status (except SD path updates `sd_refund_form_emailed_at`).
 */

import {
  isBookingWorkflowEmailKind,
  sendBookingWorkflowEmail,
  SendBookingWorkflowEmailError,
  BOOKING_WORKFLOW_EMAIL_KINDS,
} from '../_shared/sendBookingWorkflowEmail.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('send-booking-workflow-email', async (req) => {
  requireHttpMethod(req, 'POST');
  const { property } = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const propertyId = property.id;
  const body = await readJsonBody(req);
  const bookingId = body?.bookingId;
  const kind = body?.kind;

  if (!bookingId || typeof bookingId !== 'string') {
    return jsonError(req, 'bookingId (string) is required');
  }
  if (!isBookingWorkflowEmailKind(kind)) {
    return jsonError(req, `kind must be one of: ${BOOKING_WORKFLOW_EMAIL_KINDS.join(', ')}`);
  }

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  try {
    const data = await sendBookingWorkflowEmail(bookingId, propertyId, kind);
    return jsonResponse(req, { success: true, ...data });
  } catch (err) {
    if (err instanceof SendBookingWorkflowEmailError) {
      return jsonError(req, err.message, err.status);
    }
    throw err;
  }
});
