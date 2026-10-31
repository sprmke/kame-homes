/**
 * claim-parking-booking — atomic first-Accept-wins claim on a broadcast parking request.
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
  claimParkingBooking,
  ParkingBroadcastActionError,
} from '../_shared/parkingBroadcastActions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('claim-parking-booking', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();
  const parkingId = String(body.parkingId ?? '').trim();
  const endorsementNote = typeof body.endorsementNote === 'string' ? body.endorsementNote : '';

  if (!bookingId || !parkingId) {
    return jsonError(req, 'bookingId and parkingId are required');
  }

  const parkingAccess = await verifyParkingTeamAccess(req, parkingId, 'bookings:edit');
  const { parking: parkingRow } = parkingAccess;

  try {
    const claimed = await claimParkingBooking(parkingId, bookingId, endorsementNote, parkingRow, {
      actor: buildActorContext('dashboard', { parkingAccess }, req),
    });
    return jsonSuccess(req, { booking: claimed });
  } catch (err) {
    if (err instanceof ParkingBroadcastActionError) {
      return jsonError(req, err.message, err.status);
    }
    console.error('[claim-parking-booking]', err instanceof Error ? err.message : err);
    return jsonError(req, 'Failed to claim booking', 500);
  }
});
