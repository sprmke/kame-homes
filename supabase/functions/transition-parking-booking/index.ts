/**
 * transition-parking-booking — Simple status changes for parking-only reservations.
 * Does not invoke the stay workflow orchestrator (no calendar/sheet/email side effects).
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { withIdempotency } from '../_shared/idempotency.ts';
import { verifyParkingTeamAccess } from '../_shared/orgAuth.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { logParkingStatusChange } from '../_shared/parkingActivity.ts';
import { verifyBookingBelongsToParking } from '../_shared/parkingScope.ts';
import { canTransition, isParkingStatus } from '../_shared/parkingStatusMachine.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

// `withIdempotency`: an `Idempotency-Key` (PWA offline-outbox replay) runs this
// transition at most once.
serveAuthenticated(
  'transition-parking-booking',
  withIdempotency(async (req) => {
    requireHttpMethod(req, 'POST');
    const body = await readJsonBody(req);
    const bookingId = String(body.bookingId ?? '').trim();
    const toStatus = String(body.toStatus ?? '').trim();

    if (!bookingId || !toStatus) {
      return jsonError(req, 'bookingId and toStatus are required');
    }
    if (!isParkingStatus(toStatus)) {
      return jsonError(req, `Unknown parking status: ${toStatus}`);
    }

    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking?.parking_id) {
      return jsonError(req, 'Parking booking not found', 404);
    }

    const parkingId = String(booking.parking_id);
    const parkingAccess = await verifyParkingTeamAccess(req, parkingId, 'bookings:edit');
    await verifyBookingBelongsToParking(bookingId, parkingId);

    const fromStatus = String(booking.status ?? '');
    if (!isParkingStatus(fromStatus)) {
      return jsonError(req, `Unknown parking status: ${fromStatus}`);
    }
    // PENDING_HOST_ACCEPTANCE only resolves via claim/decline/expire; PENDING_PAYMENT only via
    // webhook fulfillment, payment-TTL release, or guest cancel — never a plain transition.
    if (fromStatus === 'PENDING_HOST_ACCEPTANCE' || fromStatus === 'PENDING_PAYMENT') {
      return jsonError(req, `Cannot transition from ${fromStatus} to ${toStatus}`);
    }
    if (!canTransition(fromStatus, toStatus)) {
      return jsonError(req, `Cannot transition from ${fromStatus} to ${toStatus}`);
    }

    const updated = await DatabaseService.updateBookingStatus(bookingId, toStatus, fromStatus);

    await logParkingStatusChange({
      booking,
      fromStatus,
      toStatus,
      actor: buildActorContext('dashboard', { parkingAccess }, req),
    });

    return jsonResponse(req, { success: true, data: updated });
  })
);
