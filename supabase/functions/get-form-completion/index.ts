/**
 * get-form-completion — public bootstrap for the guest-form completion link
 * (calendar sync Phase 2, §6.5).
 *
 * GET ?complete=<token>
 *   → { propertySlug, stay: { checkInDate, checkOutDate, checkInTime, checkOutTime },
 *       prefill: { primaryGuestName, bookingSource }, locked: true }
 *
 * 404 unknown / rotated token · 410 once the stay has ended or the booking was cancelled.
 * Dates are returned read-only — the completion submit ignores any dates in its payload and
 * re-reads them from the stored row.
 */

import { resolveGuestFormCompletion } from '../_shared/guestFormCompletion.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

servePublic('get-form-completion', async (req) => {
  requireHttpMethod(req, 'GET');


  const limited = await publicGetRateLimitGate(req, 'get-form-completion');
  if (limited) return limited;

  const url = new URL(req.url);
  const token = url.searchParams.get('complete') ?? url.searchParams.get('token') ?? '';

  const resolved = await resolveGuestFormCompletion(token);
  if (!resolved.ok) {
    return jsonError(
      req,
      resolved.status === 410
        ? 'This guest-form link has expired'
        : 'This guest-form link is not valid',
      resolved.status
    );
  }

  const { booking, propertySlug } = resolved;

  return jsonSuccess(req, {
    propertySlug,
    locked: true,
    stay: {
      checkInDate: String(booking.check_in_date ?? ''),
      checkOutDate: String(booking.check_out_date ?? ''),
      checkInTime: String(booking.check_in_time ?? ''),
      checkOutTime: String(booking.check_out_time ?? ''),
      numberOfNights: booking.number_of_nights ?? null,
    },
    prefill: {
      primaryGuestName: String(booking.primary_guest_name ?? ''),
      bookingSource: String(booking.booking_source ?? 'Airbnb'),
    },
  });
});
