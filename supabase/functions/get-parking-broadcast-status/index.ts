/**
 * get-parking-broadcast-status — admin read: is this parking a live/past candidate
 * for a given booking? Backs the dashboard Accept/Decline visibility gate and the
 * pre-claim booking detail fallback (parking_id is still null on that row).
 */

import { createServiceClient, verifyParkingTeamAccess } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { readParkingIdFromUrl } from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-parking-broadcast-status', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId')?.trim();
  const parkingId = readParkingIdFromUrl(url);
  if (!bookingId) {
    return jsonError(req, 'bookingId query param is required');
  }
  if (!parkingId) {
    return jsonError(req, 'parking_id query param is required');
  }

  await verifyParkingTeamAccess(req, parkingId, 'bookings:view');
  const supabase = createServiceClient();

  const { data: broadcast } = await supabase
    .from('parking_booking_broadcasts')
    .select('response, notified_at, responded_at')
    .eq('booking_id', bookingId)
    .eq('parking_id', parkingId)
    .maybeSingle();

  return jsonSuccess(req, {
    exists: Boolean(broadcast),
    response: broadcast?.response ?? null,
  });
});
