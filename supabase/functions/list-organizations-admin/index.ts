/**
 * list-organizations-admin — GET the platform organization directory for `/admin/orgs`.
 * Paginated + searchable, with each org's live plan and asset counts. Super-admin only.
 * Plan assignment / billing stays in `org-subscriptions-admin`.
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

const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'suspended'];

serveSuperAdmin('list-organizations-admin', async (req) => {
  requireHttpMethod(req, 'GET');
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const p = url.searchParams;
  const search = (p.get('q') ?? '').trim();
  const planFilter = (p.get('plan') ?? '').trim(); // plan code, or 'none'
  const { page, limit } = parsePageLimit(p);

  if (p.get('summary') === 'true') {
    const [orgs, withSub, properties, parkings] = await Promise.all([
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase
        .from('organizations')
        .select('id, org_subscriptions!inner(id)', { count: 'exact', head: true })
        .in('org_subscriptions.status', LIVE_SUBSCRIPTION_STATUSES),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('parkings').select('id', { count: 'exact', head: true }),
    ]);
    const err = orgs.error ?? withSub.error ?? properties.error ?? parkings.error;
    if (err) return jsonError(req, err.message, 500);
    const total = orgs.count ?? 0;
    const subscribed = withSub.count ?? 0;
    return jsonSuccess(req, {
      summary: {
        total,
        subscribed,
        unsubscribed: total - subscribed,
        properties: properties.count ?? 0,
        parkings: parkings.count ?? 0,
      },
    });
  }

  const hasPlanFilter = planFilter.length > 0 && planFilter !== 'all';
  const subscriptionsSelect =
    hasPlanFilter && planFilter !== 'none'
      ? `org_subscriptions!inner ( id, status, price_php_snapshot, pricing_plans!inner ( code, name ) )`
      : `org_subscriptions ( id, status, price_php_snapshot, pricing_plans ( code, name ) )`;

  let query = supabase
    .from('organizations')
    .select(
      `id, name, slug, created_at, properties ( id ), parkings ( id ), ${subscriptionsSelect}`,
      { count: 'exact' }
    )
    .order('name', { ascending: true });

  if (search) {
    const pattern = postgrestOrIlikeValue(search);
    query = query.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
  }

  if (hasPlanFilter && planFilter !== 'none') {
    query = query
      .in('org_subscriptions.status', LIVE_SUBSCRIPTION_STATUSES)
      .eq('org_subscriptions.pricing_plans.code', planFilter);
  }

  const fromIdx = (page - 1) * limit;
  const { data, error, count } = await query.range(fromIdx, fromIdx + limit - 1);
  if (error) return jsonError(req, error.message, 500);

  let rows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const properties = (r.properties ?? []) as unknown[];
    const parkings = (r.parkings ?? []) as unknown[];
    const subs = (r.org_subscriptions ?? []) as Record<string, unknown>[];
    const live = subs.find((s) => LIVE_SUBSCRIPTION_STATUSES.includes(String(s.status ?? '')));
    const planJoin = live?.pricing_plans as Record<string, unknown> | undefined;
    return {
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      createdAt: r.created_at as string,
      propertyCount: properties.length,
      parkingCount: parkings.length,
      planCode: (planJoin?.code as string | undefined) ?? null,
      planName: (planJoin?.name as string | undefined) ?? null,
      subscriptionStatus: (live?.status as string | undefined) ?? null,
      mrrPhp: live?.price_php_snapshot == null ? 0 : Number(live.price_php_snapshot),
    };
  });

  // `plan=none` can't be expressed in PostgREST (absence of an embedded live row) — filter here.
  if (planFilter === 'none') {
    rows = rows.filter((row) => !row.planCode);
  }

  return jsonSuccess(req, {
    organizations: rows,
    total: planFilter === 'none' ? rows.length : (count ?? 0),
    page,
    limit,
  });
});
