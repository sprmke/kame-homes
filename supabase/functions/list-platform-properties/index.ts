/**
 * list-platform-properties — GET properties across every org (super admin), paginated + filtered server-side.
 * Query: q (search name/slug/address/residence name/org name/org slug), status, type,
 *        development (all|linked|unlinked), page, limit
 */

import { createServiceClient, serializeProperty, type PropertyRow } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod, parsePageLimit } from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

function developmentLookupByName(
  rows: { name: string; slug: string }[]
): Map<string, { name: string; slug: string }> {
  const map = new Map<string, { name: string; slug: string }>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (key) map.set(key, row);
  }
  return map;
}

serveAuthenticated('list-platform-properties', async (req) => {
  requireHttpMethod(req, 'GET');
  await verifySuperAdminJwt(req);

  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p);
  const q = (p.get('q') ?? '').trim();
  const status = (p.get('status') ?? 'all').trim();
  const type = (p.get('type') ?? 'all').trim();
  const developmentFilter = (p.get('development') ?? 'all').trim();

  const supabase = createServiceClient();

  // Lookup tables (organizations + developments) are small relative to properties —
  // loading them in full is fine, unlike the properties table itself which must stay paginated.
  const [{ data: orgs, error: orgError }, { data: developments, error: developmentError }] =
    await Promise.all([
      supabase.from('organizations').select('id, slug, name'),
      supabase.from('developments').select('name, slug'),
    ]);

  if (orgError) {
    console.error('[list-platform-properties] orgs', orgError.message);
    throw new Error('Failed to load organizations');
  }
  if (developmentError) {
    console.error('[list-platform-properties] developments', developmentError.message);
    throw new Error('Failed to load developments');
  }

  const orgRows = orgs ?? [];
  const orgById = new Map(orgRows.map((org) => [org.id as string, org]));
  const developmentByName = developmentLookupByName(
    (developments ?? []).map((row) => ({
      name: row.name as string,
      slug: row.slug as string,
    }))
  );
  const developmentNames = Array.from(developmentByName.values()).map((row) => row.name);

  let query = supabase.from('properties').select('*', { count: 'exact' });

  if (status !== 'all') query = query.eq('status', status);
  if (type !== 'all') query = query.eq('type', type);

  if (developmentFilter === 'linked') {
    if (developmentNames.length === 0) {
      return jsonSuccess(req, { properties: [], total: 0, page, limit });
    }
    query = query.in('residence_name', developmentNames);
  } else if (developmentFilter === 'unlinked') {
    query =
      developmentNames.length > 0
        ? query.or(
            `residence_name.is.null,residence_name.not.in.(${developmentNames
              .map((name) => `"${name.replace(/"/g, '""')}"`)
              .join(',')})`
          )
        : query;
  }

  if (q) {
    const pattern = postgrestOrIlikeValue(q);
    const orParts = [
      `name.ilike.${pattern}`,
      `slug.ilike.${pattern}`,
      `address.ilike.${pattern}`,
      `residence_name.ilike.${pattern}`,
      `type.ilike.${pattern}`,
      `status.ilike.${pattern}`,
    ];
    const matchingOrgIds = orgRows
      .filter(
        (org) =>
          (org.name as string)?.toLowerCase().includes(q.toLowerCase()) ||
          (org.slug as string)?.toLowerCase().includes(q.toLowerCase())
      )
      .map((org) => org.id as string);
    if (matchingOrgIds.length > 0) {
      orParts.push(`organization_id.in.(${matchingOrgIds.join(',')})`);
    }
    query = query.or(orParts.join(','));
  }

  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(fromIdx, toIdx);

  if (error) {
    console.error('[list-platform-properties] properties', error.message);
    throw new Error('Failed to list properties');
  }

  const propertyRows = (data ?? []) as PropertyRow[];

  return jsonSuccess(req, {
    properties: propertyRows.map((property) => {
      const org = orgById.get(property.organization_id);
      const residenceKey = property.residence_name?.trim().toLowerCase() ?? '';
      const development = residenceKey ? developmentByName.get(residenceKey) : undefined;

      return {
        ...serializeProperty(property),
        organizationSlug: org?.slug ?? '',
        organizationName: org?.name ?? '',
        developmentSlug: development?.slug ?? null,
        developmentName: development?.name ?? null,
      };
    }),
    total: count ?? 0,
    page,
    limit,
  });
});
