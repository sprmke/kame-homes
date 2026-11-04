/**
 * issue-guest-trip-link — Host copy link for a booking's guest trip page.
 *
 * POST { bookingId } → { tripUrl }
 * The URL carries a fresh HMAC booking access token (stateless, no DB write), so the guest
 * can open it without signing in. Property bookings only; every plan.
 */

import { bookingTargetLabel, logBookingDetailActivity } from '../_shared/bookingActivityLog.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { resolveAppSettings } from '../_shared/appSettings.ts';
import { mintGuestBookingAccessToken } from '../_shared/guestBookingAccessToken.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { guestTripPath } from '../_shared/publicGuestPaths.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('issue-guest-trip-link', async (req) => {
  requireHttpMethod(req, 'POST');
  const propertyAccess = await resolveScopedPropertyAccess(req, 'bookings:view');

  const body = await readJsonBody(req);
  const bookingId = body?.bookingId;
  if (!bookingId || typeof bookingId !== 'string') {
    return jsonError(req, 'bookingId (string) is required');
  }

  await verifyBookingBelongsToProperty(bookingId, propertyAccess.property.id);
  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || booking.parking_id) return jsonError(req, 'Booking not found', 404);

  const settings = await resolveAppSettings(propertyAccess.property.id);
  const accessToken = await mintGuestBookingAccessToken(bookingId);

  await logBookingDetailActivity({
    action: 'booking.trip_link_issued',
    propertyAccess,
    req,
    bookingId,
    targetLabel: bookingTargetLabel(booking),
  });

  return jsonSuccess(req, {
    bookingId,
    tripUrl: guestTripPath(
      settings.publicGuestAppOrigin,
      propertyAccess.property.slug,
      bookingId,
      accessToken
    ),
  });
});
