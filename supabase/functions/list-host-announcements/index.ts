/**
 * list-host-announcements — active platform + development announcements for the signed-in host.
 */

import {
  createServiceClient,
  verifyOrgAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from '../_shared/orgAuth.ts';
import {
  loadDevelopmentHostAnnouncementsByNames,
  loadPlatformHostAnnouncements,
  mergeLiveHostAnnouncements,
} from '../_shared/hostAnnouncements.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { hasOrgPermission } from '../_shared/orgTeamPermissions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function forbiddenAccess(): Response {
  return new Response(JSON.stringify({ success: false, error: 'Access restricted' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function resolveResidenceNames(
  orgId: string,
  propertyId: string | null,
  parkingId: string | null
): Promise<string[]> {
  const supabase = createServiceClient();

  if (propertyId) {
    const { data } = await supabase
      .from('properties')
      .select('residence_name')
      .eq('id', propertyId)
      .eq('organization_id', orgId)
      .maybeSingle();
    const name = typeof data?.residence_name === 'string' ? data.residence_name.trim() : '';
    return name ? [name] : [];
  }

  if (parkingId) {
    const { data } = await supabase
      .from('parkings')
      .select('residence_name')
      .eq('id', parkingId)
      .eq('organization_id', orgId)
      .maybeSingle();
    const name = typeof data?.residence_name === 'string' ? data.residence_name.trim() : '';
    return name ? [name] : [];
  }

  const [{ data: properties }, { data: parkings }] = await Promise.all([
    supabase.from('properties').select('residence_name').eq('organization_id', orgId),
    supabase.from('parkings').select('residence_name').eq('organization_id', orgId),
  ]);

  const names = new Set<string>();
  for (const row of properties ?? []) {
    const name = typeof row.residence_name === 'string' ? row.residence_name.trim() : '';
    if (name) names.add(name);
  }
  for (const row of parkings ?? []) {
    const name = typeof row.residence_name === 'string' ? row.residence_name.trim() : '';
    if (name) names.add(name);
  }
  return [...names];
}

serveAuthenticated('list-host-announcements', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() || null;
  const propertyId = url.searchParams.get('propertyId')?.trim() || null;
  const parkingId = url.searchParams.get('parkingId')?.trim() || null;

  let scopedOrgId: string;
  let scopedPropertyId = propertyId;
  let scopedParkingId = parkingId;

  if (propertyId) {
    // Soft-allow plan-limited seats (empty banner) instead of 403 while gates mount.
    const ctx = await verifyPropertyAccess(req, propertyId);
    if (!ctx.planLimited && !ctx.permissions.includes('bookings:view')) {
      throw forbiddenAccess();
    }
    scopedOrgId = ctx.org.id;
  } else if (parkingId) {
    const ctx = await verifyParkingTeamAccess(req, parkingId, 'bookings:view');
    scopedOrgId = ctx.org.id;
  } else if (orgId) {
    const ctx = await verifyOrgAccess(req, { orgId });
    if (!ctx.planLimited && !hasOrgPermission(ctx.permissions, 'org:dashboard:view')) {
      throw forbiddenAccess();
    }
    scopedOrgId = ctx.org.id;
    scopedPropertyId = null;
    scopedParkingId = null;
  } else {
    return jsonError(req, 'orgId, propertyId, or parkingId is required');
  }

  const supabase = createServiceClient();
  try {
    const [platform, residenceNames] = await Promise.all([
      loadPlatformHostAnnouncements(supabase),
      resolveResidenceNames(scopedOrgId, scopedPropertyId, scopedParkingId),
    ]);
    const developmentGroups = await loadDevelopmentHostAnnouncementsByNames(
      supabase,
      residenceNames
    );
    const announcements = mergeLiveHostAnnouncements(platform, developmentGroups);
    return jsonSuccess(req, { announcements });
  } catch (error) {
    console.error('[list-host-announcements]', error);
    throw new Error('Failed to load host announcements');
  }
});
