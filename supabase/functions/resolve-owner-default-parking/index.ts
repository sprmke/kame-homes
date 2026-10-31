/**
 * resolve-owner-default-parking — host-facing: which org-owned parking slot (if any)
 * should be the default for arranging parking on a property stay.
 *
 * Trigger: GET ?property_id=<id>&bookingId=<id>
 * Auth:    resolveScopedPropertyAccess(req, 'bookings:view')
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  resolveOwnerDefaultParking,
  readPreferredOwnerParkingId,
} from '../_shared/ownerDefaultParking.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('resolve-owner-default-parking', async (req) => {
  requireHttpMethod(req, 'GET');
  const { property } = await resolveScopedPropertyAccess(req, 'bookings:view');
  const propertyId = property.id;

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId')?.trim();
  if (!bookingId) return jsonError(req, 'bookingId is required');

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const supabase = createServiceClient();
  const { data: booking, error } = await supabase
    .from('guest_submissions')
    .select('id, check_in_date, check_out_date, car_brand_model')
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    return jsonError(req, 'Booking not found', 404);
  }

  // Prefer motorcycle only when brand/model clearly indicates one; else car (default inventory).
  const brand = String(booking.car_brand_model ?? '').toLowerCase();
  const vehicleType =
    brand.includes('motor') || brand.includes('scooter') || brand.includes('bike')
      ? 'motorcycle'
      : 'car';

  const result = await resolveOwnerDefaultParking({
    organizationId: property.organization_id,
    propertyResidenceName: property.residence_name,
    checkInDate: String(booking.check_in_date ?? ''),
    checkOutDate: String(booking.check_out_date ?? ''),
    vehicleType,
    preferredParkingId: readPreferredOwnerParkingId(property.settings),
  });

  return jsonSuccess(req, result);
});
