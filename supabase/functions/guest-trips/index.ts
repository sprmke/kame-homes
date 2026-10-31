/**
 * guest-trips — List bookings for the signed-in guest account.
 */

import { listGuestTrips } from '../_shared/guestProfileService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('guest-trips', async (req, user) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const trips = await listGuestTrips(user);
  return jsonSuccess(req, { trips });
});
