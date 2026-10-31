/**
 * get-linked-parking-booking — Phase 7 property booking detail read. The linked marketplace
 * parking booking lives outside the requesting property's own scope (a different org may own
 * the parking listing), so this can't be a naive client-side `guest_submissions` query the way
 * `useBooking` reads the property booking itself — it's a small service-role-backed read,
 * gated the same way `get-booking-ai-review` gates its property-scoped booking reads.
 *
 * Trigger: GET /functions/v1/get-linked-parking-booking?property_id=<id>&bookingId=<id>
 * Auth:    resolveScopedPropertyAccess(req, 'bookings:view')
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveParkingHostContact } from '../_shared/parkingBroadcast.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-linked-parking-booking', async (req) => {
  requireHttpMethod(req, 'GET');
  const { property } = await resolveScopedPropertyAccess(req, 'bookings:view');
  const propertyId = property.id;

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId')?.trim();
  if (!bookingId) throw new Error('bookingId is required');

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const supabase = createServiceClient();
  const { data: parkingBooking } = await supabase
    .from('guest_submissions')
    .select(
      'id, status, parking_id, organization_id:parking_request_organization_id, ' +
        'endorsement_sent_at, endorsement_send_error, endorsement_email_snapshot'
    )
    .eq('linked_property_booking_id', bookingId)
    .maybeSingle();

  if (!parkingBooking) {
    return jsonSuccess(req, { linked: false });
  }

  // A claimed booking's real organization is the matched `parkings` row's own org, not the
  // pre-claim `parking_request_organization_id` snapshot — same distinction `resolveParkingHostContact`
  // callers elsewhere in this codebase make.
  let organizationId = parkingBooking.organization_id as string | null;
  if (parkingBooking.parking_id) {
    const { data: parking } = await supabase
      .from('parkings')
      .select('organization_id')
      .eq('id', parkingBooking.parking_id)
      .maybeSingle();
    organizationId = parking?.organization_id ?? organizationId;
  }

  const hostContact =
    parkingBooking.endorsement_sent_at && organizationId
      ? await resolveParkingHostContact(supabase, {
          id: String(parkingBooking.parking_id ?? ''),
          organization_id: organizationId,
        })
      : null;

  return jsonSuccess(req, {
    linked: true,
    parkingBookingId: parkingBooking.id,
    status: parkingBooking.status,
    endorsementSentAt: parkingBooking.endorsement_sent_at,
    endorsementSendError: parkingBooking.endorsement_send_error,
    endorsementEmailSnapshot: parkingBooking.endorsement_email_snapshot,
    hostContact,
  });
});
