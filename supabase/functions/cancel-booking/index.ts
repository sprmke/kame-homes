/**
 * cancel-booking — Admin endpoint to cancel a booking.
 */

import { WorkflowOrchestrator } from '../_shared/workflowOrchestrator.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { notifyTelegramCancellation } from '../_shared/telegramMarketing.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { releaseAppliedVoucherOnCancel } from '../_shared/voucherRedemption.ts';

serveAuthenticated('cancel-booking', async (req) => {
  requireHttpMethod(req, 'POST');
  const propertyAccess = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const { property } = propertyAccess;
  const propertyId = property.id;
  const body = await readJsonBody(req);
  const { bookingId, confirm, devControls = {} } = body;

  if (!bookingId) {
    return jsonError(req, 'Booking ID is required');
  }

  if (confirm !== true) {
    return jsonError(
      req,
      'Cancellation requires confirmation. Send { "confirm": true } in the request body.'
    );
  }

  await verifyBookingBelongsToProperty(String(bookingId), propertyId);

  const booking = await DatabaseService.getBookingById(String(bookingId));
  if (!booking) {
    return jsonError(req, 'Booking not found', 404);
  }

  if (booking.status === 'CANCELLED') {
    return jsonError(req, 'Booking is already cancelled');
  }

  console.log(`Cancelling booking: ${bookingId}`);

  const result = await WorkflowOrchestrator.transition(
    String(bookingId),
    'CANCELLED',
    {},
    devControls,
    true,
    buildActorContext('dashboard', { propertyAccess }, req)
  );

  try {
    await releaseAppliedVoucherOnCancel(createServiceClient(), {
      id: String(bookingId),
      applied_voucher_source_booking_id:
        (booking.applied_voucher_source_booking_id as string | null | undefined) ?? null,
    });
  } catch (voucherErr) {
    console.error('[cancel-booking] voucher release failed (non-fatal):', voucherErr);
  }

  try {
    await notifyTelegramCancellation(
      booking.check_in_date as string,
      booking.check_out_date as string,
      { propertyId: String(booking.property_id ?? propertyId) }
    );
  } catch (tgErr) {
    console.error('[cancel-booking] Telegram notify failed (non-fatal):', tgErr);
  }

  return jsonResponse(req, {
    success: true,
    message: 'Booking cancelled successfully. All data preserved; dates are now available.',
    bookingId,
    guestName: booking.primary_guest_name,
    data: result,
  });
});
