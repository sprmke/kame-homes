/**
 * request-parking-endorsement — guest-triggered resend when the auto-send on payment success
 * failed (Phase 5 decision #4). Only usable once payment is confirmed and no send has
 * succeeded yet.
 */

import {
  ParkingEndorsementRequestError,
  requestParkingEndorsementResend,
} from '../_shared/parkingEndorsementEmail.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('request-parking-endorsement', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();

  if (!bookingId) {
    return jsonError(req, 'bookingId is required');
  }

  try {
    const result = await requestParkingEndorsementResend(bookingId, user.id, user.email);
    return jsonSuccess(req, result);
  } catch (err) {
    if (err instanceof ParkingEndorsementRequestError) {
      return jsonError(req, err.message, err.status);
    }
    console.error('[request-parking-endorsement]', err instanceof Error ? err.message : err);
    return jsonError(req, 'Failed to send endorsement', 500);
  }
});
