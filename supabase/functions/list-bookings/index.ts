/**
 * list-bookings — Admin paginated booking list.
 * Property scope: ?property_id=… (property stays only)
 * Parking scope: ?parking_id=… (parking reservations only)
 * Org scope: ?org_slug=… or ?org_id=… (property stays + parking reservations)
 * Scoped org admins (`all_listings = false`) only see bookings for assigned listings.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { jsonResponse, parsePageLimit } from '../_shared/httpResponse.ts';
import {
  resolveAssignedListingIdsForOrgUser,
  verifyParkingTeamAccess,
} from '../_shared/orgAuth.ts';
import {
  readOrgIdFromUrl,
  readOrgSlugFromUrl,
  readPropertyIdFromUrl,
  resolveOrgAccessContext,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-bookings', async (req) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  const explicitPropertyId = readPropertyIdFromUrl(url);
  const explicitParkingId = p.get('parking_id')?.trim() || null;
  const orgSlug = readOrgSlugFromUrl(url);
  const orgIdParam = readOrgIdFromUrl(url);
  const bookingKindRaw = p.get('booking_kind')?.trim() ?? '';
  const bookingKind =
    bookingKindRaw === 'property' || bookingKindRaw === 'parking' ? bookingKindRaw : null;

  let propertyId: string | undefined;
  let parkingId: string | undefined;
  let orgId: string | undefined;
  let propertyIds: string[] | undefined;
  let parkingIds: string[] | undefined;
  let includePropertyMeta = false;
  let includeParkingMeta = false;

  if (explicitParkingId) {
    await verifyParkingTeamAccess(req, explicitParkingId, 'bookings:view');
    parkingId = explicitParkingId;
    includeParkingMeta = true;
  } else if (orgSlug || orgIdParam) {
    const ctx = await resolveOrgAccessContext(req, 'org:bookings:view');
    includePropertyMeta = true;
    includeParkingMeta = true;

    if (explicitPropertyId) {
      const { property, org: propertyOrg } = await resolveScopedPropertyAccess(
        req,
        'bookings:view',
        explicitPropertyId
      );
      if (propertyOrg.id !== ctx.org.id) {
        return jsonResponse(req, { success: false, error: 'Property not in organization' }, 403);
      }
      propertyId = property.id;
      includePropertyMeta = true;
      includeParkingMeta = false;
    } else if (ctx.canListAllProperties) {
      orgId = ctx.org.id;
    } else {
      const assigned = await resolveAssignedListingIdsForOrgUser(ctx.user.id, ctx.org.id);
      propertyIds = assigned.propertyIds;
      parkingIds = assigned.parkingIds;
    }
  } else if (explicitPropertyId) {
    const { property } = await resolveScopedPropertyAccess(
      req,
      'bookings:view',
      explicitPropertyId
    );
    propertyId = property.id;
  } else {
    return jsonResponse(
      req,
      { success: false, error: 'property_id, parking_id, or org_slug is required' },
      400
    );
  }

  const q = p.get('q') ?? '';
  const statusRaw = p.getAll('status');
  const from = p.get('from') ?? null;
  const to = p.get('to') ?? null;
  const hasPets =
    p.get('has_pets') === 'true' ? true : p.get('has_pets') === 'false' ? false : null;
  const needParking =
    p.get('need_parking') === 'true' ? true : p.get('need_parking') === 'false' ? false : null;
  const showCompletedBookings =
    p.get('show_completed_bookings') === 'true' ||
    p.get('show_previous_bookings') === 'true' ||
    p.get('hide_stale_completed') === 'false';
  const expandImportedBatch = p.get('expand_imported_batch') === 'true';
  const sort = (p.get('sort') ?? 'status_priority:asc') as
    | 'status_priority:asc'
    | 'check_in_date:asc'
    | 'check_in_date:desc'
    | 'created_at:asc'
    | 'created_at:desc';
  const { page, limit } = parsePageLimit(p, { maxLimit: 200 });

  const { rows, total } = await DatabaseService.listBookings({
    propertyId,
    parkingId,
    orgId,
    propertyIds,
    parkingIds,
    includePropertyMeta,
    includeParkingMeta,
    bookingKind,
    q,
    status: statusRaw,
    from,
    to,
    hasPets,
    needParking,
    sort,
    page,
    limit,
    showCompletedBookings,
    expandImportedBatch,
  });

  return jsonResponse(req, { success: true, data: rows, total, page, limit });
});
