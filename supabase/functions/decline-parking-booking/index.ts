/**
 * decline-parking-booking — a host declines their broadcast candidacy.
 * When every candidate has declined, the booking terminates to NO_HOST_AVAILABLE
 * (before TTL) and the guest is notified once.
 */

import { verifyParkingTeamAccess } from '../_shared/orgAuth.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  declineParkingBooking,
  ParkingBroadcastActionError,
} from '../_shared/parkingBroadcastActions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('decline-parking-booking', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();
  const parkingId = String(body.parkingId ?? '').trim();

  if (!bookingId || !parkingId) {
    return jsonError(req, 'bookingId and parkingId are required');
  }

  const parkingAccess = await verifyParkingTeamAccess(req, parkingId, 'bookings:edit');

  try {
    const result = await declineParkingBooking(parkingId, bookingId, {
      actor: buildActorContext('dashboard', { parkingAccess }, req),
    });
    return jsonSuccess(req, result);
  } catch (err) {
    if (err instanceof ParkingBroadcastActionError) {
      return jsonError(req, err.message, err.status);
    }
    console.error('[decline-parking-booking]', err instanceof Error ? err.message : err);
    return jsonError(req, 'Failed to decline booking', 500);
  }
});
