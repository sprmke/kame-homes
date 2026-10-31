/**
 * list-super-admin-audit — GET the super-admin action log for `/admin/audit` and the
 * org-hub Activity tab. Filters: ?targetType= &targetId= &actor= &action= &page= &limit=.
 * Super-admin only, read-only.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  parsePageLimit,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

serveSuperAdmin('list-super-admin-audit', async (req) => {
  requireHttpMethod(req, 'GET');
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p, { maxLimit: 200 });
  const targetType = p.get('targetType')?.trim() || null;
  const targetId = p.get('targetId')?.trim() || null;
  const actor = p.get('actor')?.trim() || null;
  const action = p.get('action')?.trim() || null;
  const search = p.get('q')?.trim() || null;

  let query = supabase
    .from('super_admin_audit_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (targetType) query = query.eq('target_type', targetType);
  if (targetId) query = query.eq('target_id', targetId);
  if (actor) query = query.ilike('actor_email', `%${actor}%`);
  if (action) query = query.eq('action', action);
  if (search) {
    const pattern = postgrestOrIlikeValue(search);
    query = query.or(`summary.ilike.${pattern},action.ilike.${pattern}`);
  }

  const fromIdx = (page - 1) * limit;
  const { data, error, count } = await query.range(fromIdx, fromIdx + limit - 1);
  if (error) return jsonError(req, error.message, 500);

  return jsonSuccess(req, {
    events: (data ?? []).map((row) => ({
      id: row.id as string,
      actorEmail: row.actor_email as string,
      action: row.action as string,
      targetType: (row.target_type as string | null) ?? null,
      targetId: (row.target_id as string | null) ?? null,
      summary: row.summary as string,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    })),
    total: count ?? 0,
    page,
    limit,
  });
});
