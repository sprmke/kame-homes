/**
 * respond-cancellation-request — host approves or declines a guest cancellation request.
 *
 * POST { bookingId, requestId, action: 'approve' | 'decline', hostMessage?, refundOverridePhp?, overrideNote? }
 */

import { buildActorContext } from '../_shared/activityLog.ts';
import {
  CancellationNotAllowedError,
  CANCELLATION_REQUEST_COLUMNS,
  cancelBooking,
  declineCancellationRequest,
} from '../_shared/cancellationService.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { sendCancellationRequestGuest } from '../_shared/emailService.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { releaseAppliedVoucherOnCancel } from '../_shared/voucherRedemption.ts';

serveAuthenticated('respond-cancellation-request', async (req) => {
  requireHttpMethod(req, 'POST');
  const propertyAccess = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const propertyId = propertyAccess.property.id;
  const body = await readJsonBody(req);

  const bookingId = String(body.bookingId ?? '').trim();
  const requestId = String(body.requestId ?? '').trim();
  const action = body.action === 'decline' ? 'decline' : 'approve';
  if (!bookingId || !requestId) return jsonError(req, 'bookingId and requestId are required');

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return jsonError(req, 'Booking not found', 404);

  const sb = createServiceClient();
  const { data: request } = await sb
    .from('booking_cancellation_requests')
    .select(CANCELLATION_REQUEST_COLUMNS)
    .eq('id', requestId)
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (!request) return jsonError(req, 'Cancellation request not found', 404);
  if (request.status !== 'open') return jsonError(req, 'This request is already resolved.', 409);

  const actor = buildActorContext('dashboard', { propertyAccess }, req);
  const hostMessage = typeof body.hostMessage === 'string' ? body.hostMessage.trim() : '';

  if (action === 'decline') {
    if (!hostMessage) return jsonError(req, 'Add a message so the guest knows why.');
    const declined = await declineCancellationRequest({
      bookingId,
      requestId,
      hostMessage,
      actor,
    });
    if (!declined) return jsonError(req, 'This request is already resolved.', 409);
    try {
      await sendCancellationRequestGuest(booking, { state: 'declined', hostMessage });
    } catch (emailErr) {
      console.error('[respond-cancellation-request] decline email failed (non-fatal):', emailErr);
    }
    return jsonSuccess(req, { declined: true });
  }

  const overrideRaw = body.refundOverridePhp;
  const refundOverridePhp =
    overrideRaw === null || overrideRaw === undefined || overrideRaw === ''
      ? null
      : Number(overrideRaw);
  const overrideNote = typeof body.overrideNote === 'string' ? body.overrideNote.trim() : '';
  if (refundOverridePhp != null) {
    if (!Number.isFinite(refundOverridePhp)) {
      return jsonError(req, 'Refund override must be a valid amount');
    }
    if (!overrideNote) return jsonError(req, 'Add a note explaining the refund override');
  }

  try {
    const result = await cancelBooking({
      booking,
      initiator: 'guest',
      reasonCode: (request.reason_code as never) ?? 'other',
      reasonNote: request.reason_note ? String(request.reason_note) : null,
      overrideRefundPhp: refundOverridePhp,
      overrideNote: overrideNote || null,
      notifyGuest: true,
      actor,
    });

    try {
      await releaseAppliedVoucherOnCancel(createServiceClient(), {
        id: bookingId,
        applied_voucher_source_booking_id:
          (booking.applied_voucher_source_booking_id as string | null | undefined) ?? null,
      });
    } catch (voucherErr) {
      console.error('[respond-cancellation-request] voucher release failed (non-fatal):', voucherErr);
    }

    return jsonSuccess(req, {
      approved: true,
      outcome: result.outcome,
      refund: result.refund,
    });
  } catch (err) {
    if (err instanceof CancellationNotAllowedError) {
      return jsonError(req, err.message, err.status);
    }
    console.error('[respond-cancellation-request] approve failed:', err);
    return jsonError(req, 'Could not approve the request. Try again.', 500);
  }
});
