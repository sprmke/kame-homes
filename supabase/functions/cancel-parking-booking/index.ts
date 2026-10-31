/**
 * cancel-parking-booking — guest-initiated cancel while searching or awaiting payment
 * (overview decision D7/#5). Not available after payment succeeds.
 */

import { cancelParkingBooking, ParkingCancellationError } from '../_shared/parkingCancellation.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('cancel-parking-booking', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();

  if (!bookingId) {
    return jsonError(req, 'bookingId is required');
  }

  try {
    const result = await cancelParkingBooking(bookingId, user.id, user.email);
    return jsonSuccess(req, result);
  } catch (err) {
    if (err instanceof ParkingCancellationError) {
      return jsonError(req, err.message, err.status);
    }
    console.error('[cancel-parking-booking]', err instanceof Error ? err.message : err);
    return jsonError(req, 'Failed to cancel booking', 500);
  }
});
