/**
 * guest-cancellation-request — create or withdraw a guest cancellation request
 * when the policy is request-mode.
 *
 * POST { bookingId, accessToken?, action: 'create' | 'withdraw', reasonCode?, reasonNote? }
 */

import { buildActorContext } from '../_shared/activityLog.ts';
import {
  CancellationNotAllowedError,
  createCancellationRequest,
  isCancellationReasonCode,
  withdrawCancellationRequest,
  type CancellationReasonCode,
} from '../_shared/cancellationService.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { sendBookingCancelledHost, sendCancellationRequestGuest } from '../_shared/emailService.ts';
import { authorizeGuestTripAccess } from '../_shared/guestTripAccess.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

servePublic('guest-cancellation-request', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();
  if (!UUID_RE.test(bookingId)) return jsonError(req, 'Booking not found', 404);

  const user = await tryGetAuthenticatedUser(req);
  const limited = await rateLimitGate(req, {
    scope: 'guest-cancellation-request',
    identity: `${user?.id ?? 'anon'}:${bookingId}`,
    limit: 5,
    windowSec: 300,
  });
  if (limited) return limited;

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || booking.parking_id) return jsonError(req, 'Booking not found', 404);

  const access = await authorizeGuestTripAccess({
    booking,
    accessToken: typeof body.accessToken === 'string' ? body.accessToken : null,
    user,
  });
  if (!access.ok) {
    return jsonError(
      req,
      access.reason === 'sign_in_required'
        ? 'Sign in with the email you booked with.'
        : 'Booking not found',
      access.reason === 'sign_in_required' ? 401 : 404
    );
  }

  const actor = buildActorContext(
    'public_form',
    {
      guest: {
        name: String(booking.primary_guest_name ?? '').trim() || null,
        email: String(booking.guest_email ?? '').trim() || null,
      },
    },
    req
  );

  const action = body.action === 'withdraw' ? 'withdraw' : 'create';

  try {
    if (action === 'withdraw') {
      const withdrawn = await withdrawCancellationRequest({ bookingId, actor });
      if (!withdrawn) return jsonError(req, 'No open request to withdraw.', 404);
      return jsonSuccess(req, { withdrawn: true });
    }

    const reasonCode: CancellationReasonCode = isCancellationReasonCode(body.reasonCode)
      ? body.reasonCode
      : 'other';
    const reasonNote = typeof body.reasonNote === 'string' ? body.reasonNote.trim() : '';
    const request = await createCancellationRequest({
      booking,
      reasonCode,
      reasonNote: reasonNote || null,
      actor,
    });

    try {
      await sendCancellationRequestGuest(booking, { state: 'received' });
    } catch (emailErr) {
      console.error('[guest-cancellation-request] guest email failed (non-fatal):', emailErr);
    }
    try {
      await sendBookingCancelledHost(booking, {
        refundDuePhp: 0,
        refundPercent: null,
        reasonCode,
        reasonNote: reasonNote || null,
        initiator: 'guest',
        requestOnly: true,
      });
    } catch (emailErr) {
      console.error('[guest-cancellation-request] host email failed (non-fatal):', emailErr);
    }

    return jsonSuccess(req, { request });
  } catch (err) {
    if (err instanceof CancellationNotAllowedError) {
      return jsonError(req, err.message, err.status);
    }
    console.error('[guest-cancellation-request] failed:', err);
    return jsonError(req, 'Could not send the request. Try again.', 500);
  }
});
