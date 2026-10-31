/**
 * list-developments — GET platform developments (super admin), paginated + filtered server-side.
 * Query: q (search name/developer/city/location/type label/status label), status, type, page, limit
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  developmentStatsByName,
  serializeDevelopment,
  type DevelopmentRow,
} from '../_shared/developmentSerialize.ts';
import { jsonSuccess, requireHttpMethod, parsePageLimit } from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

const DEVELOPMENT_TYPE_LABELS: Record<string, string> = {
  CONDOMINIUM: 'Condominium',
  SUBDIVISION: 'Subdivision',
  MIXED_USE: 'Mixed use',
  TOWNHOUSE: 'Townhouse',
  COMMERCIAL: 'Commercial',
};

const DEVELOPMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

function labelMatches(query: string, labels: Record<string, string>): string[] {
  return Object.entries(labels)
    .filter(([, label]) => label.toLowerCase().includes(query))
    .map(([value]) => value);
}

serveAuthenticated('list-developments', async (req) => {
  requireHttpMethod(req, 'GET');
  await verifySuperAdminJwt(req);

  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p);
  const q = (p.get('q') ?? '').trim();
  const status = (p.get('status') ?? 'all').trim();
  const type = (p.get('type') ?? 'all').trim();

  const supabase = createServiceClient();
  let query = supabase.from('developments').select('*', { count: 'exact' });

  if (status !== 'all') query = query.eq('status', status);
  if (type !== 'all') query = query.eq('type', type);

  if (q) {
    const lowerQ = q.toLowerCase();
    const pattern = postgrestOrIlikeValue(q);
    const orParts = [
      `name.ilike.${pattern}`,
      `developer_name.ilike.${pattern}`,
      `city.ilike.${pattern}`,
      `location.ilike.${pattern}`,
    ];
    const matchingTypes = labelMatches(lowerQ, DEVELOPMENT_TYPE_LABELS);
    const matchingStatuses = labelMatches(lowerQ, DEVELOPMENT_STATUS_LABELS);
    if (matchingTypes.length > 0) orParts.push(`type.in.(${matchingTypes.join(',')})`);
    if (matchingStatuses.length > 0) orParts.push(`status.in.(${matchingStatuses.join(',')})`);
    query = query.or(orParts.join(','));
  }

  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(fromIdx, toIdx);

  if (error) {
    console.error('[list-developments]', error.message);
    throw new Error('Failed to list developments');
  }

  const rows = (data ?? []) as DevelopmentRow[];

  const statsMap = await developmentStatsByName(
    supabase,
    rows.map((row) => row.name)
  );

  return jsonSuccess(req, {
    developments: rows.map((row) =>
      serializeDevelopment(row, statsMap.get(row.name) ?? { propertyCount: 0, parkingCount: 0 })
    ),
    total: count ?? 0,
    page,
    limit,
  });
});
