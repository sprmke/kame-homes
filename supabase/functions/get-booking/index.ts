/**
 * get-booking — minimal single-booking read.
 * Fills a confirmed gap: list-bookings is the only booking read surface today; the AI dashboard
 * assistant's `get_booking` tool (docs/workflow/planned/ai-dashboard-assistant.md §2) needs a
 * single-record fetch instead of paginating the list endpoint for one row.
 *
 * Scope: ?property_id=… (property stays only) or ?org_id=…/?org_slug=… (any property in org).
 */

import { computeTotalGuestBalanceFromBooking } from '../_shared/totalGuestBalance.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  listPropertyIdsForOrganization,
  readOrgIdFromUrl,
  readOrgSlugFromUrl,
  readPropertyIdFromUrl,
  resolveOrgAccessContext,
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

serveAuthenticated('get-booking', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('booking_id')?.trim();
  if (!bookingId) {
    return jsonError(req, 'booking_id is required', 400);
  }

  const explicitPropertyId = readPropertyIdFromUrl(url);
  const orgSlug = readOrgSlugFromUrl(url);
  const orgId = readOrgIdFromUrl(url);

  let propertyId: string;
  if (explicitPropertyId) {
    const { property } = await resolveScopedPropertyAccess(
      req,
      'bookings:view',
      explicitPropertyId
    );
    propertyId = property.id;
    await verifyBookingBelongsToProperty(bookingId, propertyId);
  } else if (orgSlug || orgId) {
    const ctx = await resolveOrgAccessContext(req, 'org:bookings:view');
    const orgPropertyIds = await listPropertyIdsForOrganization(ctx.org.id);

    const sb = createServiceClient();
    const { data: row, error } = await sb
      .from('guest_submissions')
      .select('property_id')
      .eq('id', bookingId)
      .maybeSingle();
    if (error || !row) {
      return jsonError(req, 'Booking not found', 404);
    }
    if (!orgPropertyIds.includes(row.property_id as string)) {
      return jsonError(req, 'Booking not found in organization', 404);
    }
    propertyId = row.property_id as string;
  } else {
    return jsonError(req, 'property_id, org_id, or org_slug is required', 400);
  }

  const sb = createServiceClient();
  const [{ data: booking, error: bookingError }, { data: property }] = await Promise.all([
    sb.from('guest_submissions').select('*').eq('id', bookingId).maybeSingle(),
    sb.from('properties').select('id, name').eq('id', propertyId).maybeSingle(),
  ]);

  if (bookingError || !booking) {
    return jsonError(req, 'Booking not found', 404);
  }

  const totalDue = computeTotalGuestBalanceFromBooking(booking as Record<string, unknown>);
  const balanceDue = totalDue === null ? null : totalDue - num(booking.guest_balance_paid_amount);

  return jsonSuccess(req, {
    bookingId: booking.id,
    guestName: booking.primary_guest_name ?? '',
    status: booking.status,
    checkIn: booking.check_in_date,
    checkOut: booking.check_out_date,
    propertyId,
    propertyName: property?.name ?? '',
    balanceDue,
  });
});
