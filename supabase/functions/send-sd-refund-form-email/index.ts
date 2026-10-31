/**
 * send-sd-refund-form-email — Admin-only: re-send the guest Check-out & SD Refund Details email.
 *
 * POST { bookingId }
 * Status must be READY_FOR_CHECKIN (after automated email may run) or READY_FOR_CHECKOUT.
 * Does not change status; updates sd_refund_form_emailed_at (+ Free-tier manual-send map).
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { sendSdRefundFormRequest } from '../_shared/emailService.ts';
import { rawPropertyAutomationEnabled } from '../_shared/propertyAutomationToggles.ts';
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
import {
  formatWorkflowEmailResendWait,
  lastWorkflowEmailManualSentAt,
  mergeWorkflowEmailManualSentAt,
  parseWorkflowEmailManualSentAt,
  propertyHasAutomatedBookingFlow,
  workflowEmailManualCooldownRemainingMs,
} from '../_shared/workflowEmailManualSendCooldown.ts';

const SD_KIND = 'sd_refund_form_request';

serveAuthenticated('send-sd-refund-form-email', async (req) => {
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

  if (booking.status !== 'READY_FOR_CHECKOUT' && booking.status !== 'READY_FOR_CHECKIN') {
    return jsonError(
      req,
      `Booking must be in READY_FOR_CHECKIN or READY_FOR_CHECKOUT (current: ${booking.status})`
    );
  }

  const sdEmailAllowed = await rawPropertyAutomationEnabled(propertyId, 'emailSdRefundCheckout');
  if (!sdEmailAllowed) {
    return jsonError(
      req,
      'Check-out & SD refund emails are disabled in organization automations',
      409
    );
  }

  const sentMap = parseWorkflowEmailManualSentAt(
    (booking as Record<string, unknown>).workflow_email_manual_sent_at
  );
  const hasAutomatedFlow = await propertyHasAutomatedBookingFlow(propertyId);
  if (!hasAutomatedFlow) {
    const lastSent = lastWorkflowEmailManualSentAt(
      sentMap,
      SD_KIND,
      (booking as { sd_refund_form_emailed_at?: string | null }).sd_refund_form_emailed_at
    );
    const remainingMs = workflowEmailManualCooldownRemainingMs(lastSent);
    if (remainingMs > 0) {
      return jsonError(req, formatWorkflowEmailResendWait(remainingMs), 429);
    }
  }

  const sentAtIso = new Date().toISOString();
  await sendSdRefundFormRequest(booking);
  await DatabaseService.setWorkflowFields(bookingId, {
    sd_refund_form_emailed_at: sentAtIso,
    workflow_email_manual_sent_at: mergeWorkflowEmailManualSentAt(
      (booking as Record<string, unknown>).workflow_email_manual_sent_at,
      SD_KIND,
      sentAtIso
    ),
  });

  return jsonResponse(req, { success: true, bookingId });
});
