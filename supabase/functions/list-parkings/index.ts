/**
 * list-parkings — GET parkings for an org (owner/org admin with org:parkings:view).
 * Query: ?orgId=uuid OR ?orgSlug=slug
 * Scoped org admins (`all_listings = false`) only see assigned parkings.
 */

import {
  createServiceClient,
  resolveAssignedListingIdsForOrgUser,
  serializeParking,
  verifyOrgAccess,
} from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function emptyParkingStats() {
  return {
    activeReservations: 0,
    monthlyRevenue: 0,
    occupancyRate: 0,
  };
}

serveAuthenticated('list-parkings', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() ?? '';
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';

  if (!orgId && !orgSlug) {
    return jsonError(req, 'orgId or orgSlug is required');
  }

  const { user, org, canListAllProperties } = await verifyOrgAccess(
    req,
    { orgId: orgId || undefined, orgSlug: orgSlug || undefined },
    'org.parkings:view'
  );

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('*')
    .eq('organization_id', org.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('[list-parkings]', error.message);
    throw new Error('Failed to list parkings');
  }

  let parkings = data ?? [];

  if (!canListAllProperties) {
    const assigned = await resolveAssignedListingIdsForOrgUser(user.id, org.id);
    const allowed = new Set(assigned.parkingIds);
    parkings = parkings.filter((row) => allowed.has(row.id as string));
  }

  return jsonSuccess(req, {
    parkings: parkings.map((row) => ({
      ...serializeParking(row),
      stats: emptyParkingStats(),
    })),
  });
});
