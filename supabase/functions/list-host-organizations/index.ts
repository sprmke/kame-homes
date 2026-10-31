/**
 * list-host-organizations — GET orgs owned by a host (super admin), paginated server-side.
 */

import { createServiceClient, serializeOrganization, type OrgRow } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  requireHttpMethod,
  parsePageLimit,
} from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('list-host-organizations', async (req) => {
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

  const supabase = createServiceClient();

  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  let query = supabase.from('organizations').select('*', { count: 'exact' }).eq('owner_id', hostId);

  if (q) {
    const pattern = postgrestOrIlikeValue(q);
    query = query.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
  }

  const {
    data,
    error,
    count: total,
  } = await query.order('name', { ascending: true }).range(fromIdx, toIdx);

  if (error) {
    console.error('[list-host-organizations]', error.message);
    throw new Error('Failed to list host organizations');
  }

  const pagedOrgs = (data ?? []) as OrgRow[];

  const organizations = await Promise.all(
    pagedOrgs.map(async (org) => {
      const [{ count: propertyCount }, { count: parkingCount }] = await Promise.all([
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
        supabase
          .from('parkings')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
      ]);

      return {
        ...serializeOrganization(org),
        accessKind: 'owner' as const,
        stats: {
          propertyCount: propertyCount ?? 0,
          parkingCount: parkingCount ?? 0,
        },
      };
    })
  );

  return jsonSuccess(req, { organizations, total: total ?? 0, page, limit });
});
