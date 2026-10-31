/**
 * list-host-properties — GET all properties across a host's orgs (super admin),
 * searched + filtered + paginated server-side.
 * Query: hostId, q (search name/slug/address/tower/unit/residence), status, type, page, limit
 */

import { createServiceClient, serializeProperty, type PropertyRow } from '../_shared/orgAuth.ts';
import {
  computePropertyListStatsByPropertyId,
  propertyListStatsOrEmpty,
} from '../_shared/propertyListStats.ts';
import {
  jsonError,
  jsonSuccess,
  requireHttpMethod,
  parsePageLimit,
} from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('list-host-properties', async (req) => {
  requireHttpMethod(req, 'GET');
  await verifySuperAdminJwt(req);

  const url = new URL(req.url);
  const p = url.searchParams;
  const hostId = p.get('hostId')?.trim() ?? '';
  if (!hostId) {
    return jsonError(req, 'hostId is required');
  }
  const { page, limit } = parsePageLimit(p);
  const q = (p.get('q') ?? '').trim();
  const status = (p.get('status') ?? 'all').trim();
  const type = (p.get('type') ?? 'all').trim();
  const orgId = (p.get('orgId') ?? '').trim();

  const supabase = createServiceClient();
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, slug, name')
    .eq('owner_id', hostId);

  if (orgError) {
    console.error('[list-host-properties] orgs', orgError.message);
    throw new Error('Failed to load host organizations');
  }

  const orgRows = orgs ?? [];
  if (orgRows.length === 0) {
    return jsonSuccess(req, { properties: [], total: 0, page, limit });
  }

  const orgById = new Map(orgRows.map((org) => [org.id as string, org]));
  const orgIds = orgRows.map((org) => org.id as string);

  // A single valid org id narrows to that org; anything else (empty, unowned) keeps every org.
  const scopedOrgIds = orgId && orgById.has(orgId) ? [orgId] : orgIds;

  let query = supabase
    .from('properties')
    .select('*', { count: 'exact' })
    .in('organization_id', scopedOrgIds);

  if (status !== 'all') query = query.eq('status', status);
  if (type !== 'all') query = query.eq('type', type);

  if (q) {
    const pattern = postgrestOrIlikeValue(q);
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `slug.ilike.${pattern}`,
        `address.ilike.${pattern}`,
        `tower_and_unit.ilike.${pattern}`,
        `tower.ilike.${pattern}`,
        `unit_number.ilike.${pattern}`,
        `residence_name.ilike.${pattern}`,
      ].join(',')
    );
  }

  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  const {
    data,
    error,
    count: total,
  } = await query.order('name', { ascending: true }).range(fromIdx, toIdx);

  if (error) {
    console.error('[list-host-properties]', error.message);
    throw new Error('Failed to list host properties');
  }

  const properties = (data ?? []) as PropertyRow[];
  const propertyIds = properties.map((row) => row.id);
  let statsByPropertyId = new Map<string, ReturnType<typeof propertyListStatsOrEmpty>>();

  if (propertyIds.length > 0) {
    const { data: bookingRows, error: bookingsError } = await supabase
      .from('guest_submissions')
      .select(
        'property_id, status, check_in_date, check_out_date, number_of_nights, booking_rate, number_of_adults, number_of_children'
      )
      .in('property_id', propertyIds);

    if (bookingsError) {
      console.error('[list-host-properties] bookings', bookingsError.message);
      throw new Error('Failed to load property booking stats');
    }

    statsByPropertyId = computePropertyListStatsByPropertyId(bookingRows ?? []);
  }

  return jsonSuccess(req, {
    properties: properties.map((property) => {
      const org = orgById.get(property.organization_id);
      return {
        ...serializeProperty(property),
        stats: propertyListStatsOrEmpty(statsByPropertyId, property.id),
        organizationSlug: org?.slug ?? '',
        organizationName: org?.name ?? '',
      };
    }),
    total: total ?? 0,
    page,
    limit,
  });
});
