/**
 * super-admin-overview — GET platform health dashboard for `/admin`.
 * KPI rollups + 12-month growth series + plan mix + AI cost by feature +
 * an attention queue + recent activity. All counts are platform-wide and exact
 * (not page-scoped). Super-admin only.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { countPendingApprovals } from '../_shared/superAdminApprovalsQueue.ts';

const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];
const SPEND_RANGES: Record<string, number> = { '30d': 30, '90d': 90, '12mo': 365 };

type MonthBucket = { month: string; label: string };

function trailing12Months(now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    buckets.push({ month, label });
  }
  return buckets;
}

function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

serveSuperAdmin('super-admin-overview', async (req) => {
  requireHttpMethod(req, 'GET');
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? '30d';
  const spendDays = SPEND_RANGES[range] ?? 30;
  const now = new Date();
  const spendSince = new Date(now.getTime() - spendDays * 86_400_000).toISOString();
  const months = trailing12Months(now);

  const [
    orgOwnersRes,
    orgCreatedRes,
    orgCountRes,
    propertyCountRes,
    parkingCountRes,
    subscriptionsRes,
    plansRes,
    openTicketsRes,
    recentTicketsRes,
    undisbursedPayoutsRes,
    aiEventsRes,
    aiSpendRes,
    recentOrgsRes,
    pendingApprovals,
  ] = await Promise.all([
    supabase.from('organizations').select('owner_id'),
    supabase.from('organizations').select('created_at').limit(10_000),
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
    supabase.from('parkings').select('id', { count: 'exact', head: true }),
    supabase
      .from('org_subscriptions')
      .select('status, plan_id, price_php_snapshot, created_at')
      .limit(10_000),
    supabase.from('pricing_plans').select('id, code, name'),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'closed'),
    supabase
      .from('support_tickets')
      .select('id, subject, submitted_by_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('parking_payment_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid')
      .is('disbursed_at', null),
    supabase
      .from('ai_platform_usage_events')
      .select('feature, estimated_cost_usd')
      .gte('created_at', spendSince)
      .limit(50_000),
    supabase
      .from('ai_platform_usage_daily')
      .select('estimated_cost_usd, usage_date')
      .gte('usage_date', spendSince.slice(0, 10))
      .limit(50_000),
    supabase
      .from('organizations')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    countPendingApprovals(),
  ]);

  const firstError =
    orgOwnersRes.error ??
    orgCreatedRes.error ??
    orgCountRes.error ??
    propertyCountRes.error ??
    parkingCountRes.error ??
    subscriptionsRes.error ??
    plansRes.error ??
    openTicketsRes.error ??
    recentTicketsRes.error ??
    undisbursedPayoutsRes.error ??
    aiEventsRes.error ??
    aiSpendRes.error ??
    recentOrgsRes.error ??
    null;
  if (firstError) return jsonError(req, firstError.message, 500);

  const distinctHosts = new Set(
    (orgOwnersRes.data ?? []).map((r) => r.owner_id as string).filter(Boolean)
  ).size;

  const planById = new Map(
    (plansRes.data ?? []).map((p) => [
      p.id as string,
      { code: p.code as string, name: p.name as string },
    ])
  );

  const subscriptions = subscriptionsRes.data ?? [];
  const liveSubscriptions = subscriptions.filter((s) =>
    LIVE_SUBSCRIPTION_STATUSES.includes(s.status as string)
  );
  const mrr = liveSubscriptions.reduce((sum, s) => sum + Number(s.price_php_snapshot ?? 0), 0);

  // 12-month org + subscription growth
  const orgGrowthCounts = new Map(months.map((m) => [m.month, 0]));
  for (const row of orgCreatedRes.data ?? []) {
    const key = monthKey(row.created_at as string);
    if (key && orgGrowthCounts.has(key)) {
      orgGrowthCounts.set(key, (orgGrowthCounts.get(key) ?? 0) + 1);
    }
  }
  const subGrowthCounts = new Map(months.map((m) => [m.month, 0]));
  for (const row of subscriptions) {
    const key = monthKey(row.created_at as string);
    if (key && subGrowthCounts.has(key)) {
      subGrowthCounts.set(key, (subGrowthCounts.get(key) ?? 0) + 1);
    }
  }
  let runningOrgs = 0;
  let runningSubs = 0;
  const growthSeries = months.map((m) => {
    runningOrgs += orgGrowthCounts.get(m.month) ?? 0;
    runningSubs += subGrowthCounts.get(m.month) ?? 0;
    return {
      label: m.label,
      month: m.month,
      newOrgs: orgGrowthCounts.get(m.month) ?? 0,
      newSubscriptions: subGrowthCounts.get(m.month) ?? 0,
      cumulativeOrgs: runningOrgs,
      cumulativeSubscriptions: runningSubs,
    };
  });

  // Plan mix (live subscriptions by plan)
  const planMixCounts = new Map<string, { label: string; count: number }>();
  for (const s of liveSubscriptions) {
    const plan = planById.get(s.plan_id as string);
    const code = plan?.code ?? 'unknown';
    const label = plan?.name ?? 'Unknown';
    const existing = planMixCounts.get(code) ?? { label, count: 0 };
    existing.count += 1;
    planMixCounts.set(code, existing);
  }
  const planMix = Array.from(planMixCounts.entries())
    .map(([code, v]) => ({ code, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count);

  // AI cost by feature + total spend for the range
  const aiByFeature = new Map<string, number>();
  for (const ev of aiEventsRes.data ?? []) {
    const feature = (ev.feature as string) || 'other';
    aiByFeature.set(feature, (aiByFeature.get(feature) ?? 0) + Number(ev.estimated_cost_usd ?? 0));
  }
  const aiCostByFeature = Array.from(aiByFeature.entries())
    .map(([feature, costUsd]) => ({ feature, costUsd: Math.round(costUsd * 10_000) / 10_000 }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10);
  const aiSpendUsd =
    (aiSpendRes.data ?? []).reduce((sum, r) => sum + Number(r.estimated_cost_usd ?? 0), 0) || 0;

  const recentSubs = [...subscriptions]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 6)
    .map((s) => ({
      planLabel: planById.get(s.plan_id as string)?.name ?? 'Unknown plan',
      status: s.status as string,
      createdAt: s.created_at as string,
      pricePhp: Number(s.price_php_snapshot ?? 0),
    }));

  return jsonSuccess(req, {
    range,
    generatedAt: now.toISOString(),
    kpis: {
      organizations: orgCountRes.count ?? 0,
      hosts: distinctHosts,
      properties: propertyCountRes.count ?? 0,
      parkings: parkingCountRes.count ?? 0,
      liveSubscriptions: liveSubscriptions.length,
      mrrPhp: Math.round(mrr),
      openTickets: openTicketsRes.count ?? 0,
      pendingApprovals: pendingApprovals.total,
      undisbursedParkingPayouts: undisbursedPayoutsRes.count ?? 0,
      aiSpendUsd: Math.round(aiSpendUsd * 100) / 100,
    },
    growthSeries,
    planMix,
    aiCostByFeature,
    attention: {
      pendingApprovals: pendingApprovals.total,
      pendingApprovalsBreakdown: {
        orgVerification: pendingApprovals.orgVerification,
        listingVerification: pendingApprovals.listingVerification,
        externalReview: pendingApprovals.externalReview,
      },
      openTickets: openTicketsRes.count ?? 0,
      undisbursedParkingPayouts: undisbursedPayoutsRes.count ?? 0,
      unassignedSubscriptions: Math.max((orgCountRes.count ?? 0) - liveSubscriptions.length, 0),
    },
    recent: {
      organizations: (recentOrgsRes.data ?? []).map((o) => ({
        id: o.id as string,
        name: o.name as string,
        slug: o.slug as string,
        createdAt: o.created_at as string,
      })),
      subscriptions: recentSubs,
      tickets: (recentTicketsRes.data ?? []).map((t) => ({
        id: t.id as string,
        subject: t.subject as string,
        submittedByName: t.submitted_by_name as string,
        status: t.status as string,
        createdAt: t.created_at as string,
      })),
    },
  });
});
