/**
 * get-guest-trip — Guest trip hub payload (`/properties/:slug/trip?bookingId=`).
 *
 * GET ?bookingId=<uuid>&access=<token>&property=<slug>
 * Auth: booking access token for this booking, or the signed-in guest who owns it.
 * Property bookings only (parking marketplace rows have their own status page).
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { buildGuestTripPayload } from '../_shared/guestTrip.ts';
import { authorizeGuestTripAccess } from '../_shared/guestTripAccess.ts';
import { jsonResponse, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const NOT_FOUND = {
  success: false,
  error: 'not_found',
  message: "We couldn't find this booking. Check the link or contact your host.",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

servePublic('get-guest-trip', async (req) => {
  requireHttpMethod(req, 'GET');

  const user = await tryGetAuthenticatedUser(req);
  const limited = await publicGetRateLimitGate(req, 'get-guest-trip', { maxPerMin: 30 }, user);
  if (limited) return limited;

  const url = new URL(req.url);
  const bookingId = (url.searchParams.get('bookingId') ?? '').trim();
  const expectedSlug = (url.searchParams.get('property') ?? '').trim();
  if (!UUID_RE.test(bookingId)) return jsonResponse(req, NOT_FOUND, 404);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || !booking.property_id || booking.parking_id) {
    return jsonResponse(req, NOT_FOUND, 404);
  }

  const access = await authorizeGuestTripAccess({
    booking,
    accessToken: url.searchParams.get('access'),
    user,
  });
  if (!access.ok) {
    if (access.reason === 'sign_in_required') {
      return jsonResponse(
        req,
        {
          success: false,
          error: 'sign_in_required',
          message: 'Sign in with the email you booked with to see this trip.',
        },
        401
      );
    }
    // Signed in as someone else: same body as a missing booking (no existence leak).
    return jsonResponse(req, NOT_FOUND, 404);
  }

  const payload = await buildGuestTripPayload({
    booking,
    issueAccessToken: access.via === 'owner',
    expectedPropertySlug: expectedSlug,
  });
  if (!payload) return jsonResponse(req, NOT_FOUND, 404);

  return jsonSuccess(req, payload);
});
