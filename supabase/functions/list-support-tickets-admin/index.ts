/**
 * list-support-tickets-admin — GET all tickets across orgs (super admin), with
 * optional search/category/status/org filters, paginated server-side.
 * Docs: docs/workflow/in-progress/help-support-center.md, Module 3.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, parsePageLimit, requireHttpMethod } from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

serveSuperAdmin('list-support-tickets-admin', async (req) => {
  requireHttpMethod(req, 'GET');
  const url = new URL(req.url);
  const p = url.searchParams;
  const search = p.get('search')?.trim() || null;
  const category = p.get('category');
  const status = p.get('status');
  const orgId = p.get('org_id');
  const { page, limit } = parsePageLimit(p, { maxLimit: 500 });

  const sb = createServiceClient();

  if (p.get('summary') === 'true') {
    const scoped = (q: ReturnType<typeof sb.from>) => (orgId ? q.eq('organization_id', orgId) : q);
    const [totalRes, openRes, inProgressRes, resolvedRes] = await Promise.all([
      scoped(sb.from('support_tickets').select('id', { count: 'exact', head: true })),
      scoped(
        sb.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open')
      ),
      scoped(
        sb
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_progress')
      ),
      scoped(
        sb
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['resolved', 'closed'])
      ),
    ]);
    const err = totalRes.error ?? openRes.error ?? inProgressRes.error ?? resolvedRes.error;
    if (err) throw new Error(err.message);
    return jsonSuccess(req, {
      summary: {
        total: totalRes.count ?? 0,
        open: openRes.count ?? 0,
        inProgress: inProgressRes.count ?? 0,
        resolved: resolvedRes.count ?? 0,
      },
    });
  }

  let query = sb
    .from('support_tickets')
    .select('*, organizations(id, name, slug)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);
  if (orgId) query = query.eq('organization_id', orgId);

  if (search) {
    const pattern = postgrestOrIlikeValue(search);
    const orParts = [
      `subject.ilike.${pattern}`,
      `submitted_by_name.ilike.${pattern}`,
      `submitted_by_email.ilike.${pattern}`,
    ];

    const { data: orgMatches, error: orgError } = await sb
      .from('organizations')
      .select('id')
      .ilike('name', `%${search}%`);
    if (orgError) throw new Error(orgError.message);
    const orgIds = (orgMatches ?? []).map((row) => row.id as string);
    if (orgIds.length > 0) {
      orParts.push(`organization_id.in.(${orgIds.join(',')})`);
    }

    query = query.or(orParts.join(','));
  }

  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  const { data, error, count } = await query.range(fromIdx, toIdx);
  if (error) throw new Error(error.message);

  const tickets = (data ?? []).map((row) => {
    const { organizations, ...ticket } = row as typeof row & {
      organizations: { id: string; name: string; slug: string } | null;
    };
    const isGuest = !organizations;
    return {
      ...ticket,
      organizationName: organizations?.name ?? 'Explore guest',
      organizationSlug: organizations?.slug ?? null,
      channel: (ticket as { channel?: string }).channel ?? (isGuest ? 'guest' : 'host'),
    };
  });

  return jsonSuccess(req, { tickets, total: count ?? 0, page, limit });
});
