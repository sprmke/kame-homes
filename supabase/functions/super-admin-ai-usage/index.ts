/**
 * super-admin-ai-usage — GET the platform AI cost console for `/admin/ai?tab=usage`.
 * Daily spend trend + cost/credits by feature + usage by plan + Marketing Studio job
 * outcomes + top orgs by spend + current quota breaches.
 * Also: assistant feedback + the latest assistant golden eval runs (per-module pass rates).
 * Read-only, super-admin only. Backs the numbers `super-admin-overview` only summarizes.
 *
 * Totals come from SQL rollups (migration 20261316126700) because PostgREST caps raw
 * reads at max_rows (1000), which would silently undercount any busy range.
 */

import { limitNumber, resolveOrgAiLimitsBatch } from '../_shared/aiLimitResolver.ts';
import {
  summarizeMarketingGenerations,
  summarizeUsageByPlan,
  type GenerationRollupRow,
  type PlanRollupRow,
} from '../_shared/aiUsageConsoleSummary.ts';
import { platformDailyCostUsdCap } from '../_shared/aiUsageService.ts';
import { mapEvalRunRow } from '../_shared/assistantEvalSummary.ts';
import {
  summarizeAssistantFeedback,
  type AssistantFeedbackRow,
} from '../_shared/assistantFeedbackSummary.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { parsePlanFeatures } from '../_shared/planFeatures.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

const RANGE_DAYS: Record<string, number> = { '30d': 30, '90d': 90, '12mo': 365 };
const TOP_ORG_LIMIT = 25;
/** A completed job gets this long to be billed before it counts as unbilled. */
const UNBILLED_GRACE_MS = 10 * 60_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
const ratio = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

serveSuperAdmin('super-admin-ai-usage', async (req) => {
  requireHttpMethod(req, 'GET');
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? '30d';
  const days = RANGE_DAYS[range] ?? 30;
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const sinceDate = isoDate(since);
  const sinceIso = since.toISOString();
  const monthStart = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const today = isoDate(now);
  const dailySince = sinceDate < monthStart ? sinceDate : monthStart;

  const [
    dailyRes,
    featuresRes,
    topOrgsRes,
    planRollupRes,
    jobsRollupRes,
    plansRes,
    feedbackRes,
    feedbackUpRes,
    feedbackDownRes,
    evalRunsRes,
  ] = await Promise.all([
    supabase.rpc('super_admin_ai_usage_daily', { p_since: dailySince }),
    supabase.rpc('super_admin_ai_usage_features', { p_since: sinceIso }),
    supabase.rpc('super_admin_ai_usage_top_orgs', {
      p_since: sinceIso,
      p_month_start: monthStart,
      p_today: today,
      p_limit: TOP_ORG_LIMIT,
    }),
    supabase.rpc('super_admin_ai_usage_by_plan', { p_since: sinceIso, p_month_start: monthStart }),
    supabase.rpc('super_admin_marketing_generation_rollup', {
      p_since: sinceIso,
      p_unbilled_before: new Date(now.getTime() - UNBILLED_GRACE_MS).toISOString(),
    }),
    supabase
      .from('pricing_plans')
      .select('id, code, name, sort_order, features')
      .eq('is_active', true),
    supabase
      .from('ai_dashboard_assistant_feedback')
      .select('rating, reason, created_at, organization_id')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('ai_dashboard_assistant_feedback')
      .select('rating', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
      .eq('rating', 1),
    supabase
      .from('ai_dashboard_assistant_feedback')
      .select('rating', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
      .eq('rating', -1),
    supabase
      .from('ai_assistant_eval_runs')
      .select(
        'id, created_at, routed, passed, total, avg_tools_sent, prompt_version, modules, failed_case_ids'
      )
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const firstError =
    dailyRes.error ??
    featuresRes.error ??
    topOrgsRes.error ??
    planRollupRes.error ??
    jobsRollupRes.error ??
    plansRes.error ??
    feedbackRes.error ??
    null;
  if (firstError) return jsonError(req, firstError.message, 500);

  // Daily spend/calls trend (platform-wide). The rollup may start earlier (month start).
  const dailyRows = (dailyRes.data ?? []) as Array<{
    usage_date: string;
    call_count: unknown;
    cost_usd: unknown;
  }>;
  const dailySeries = dailyRows
    .filter((d) => d.usage_date >= sinceDate)
    .map((d) => ({
      date: d.usage_date,
      costUsd: round4(num(d.cost_usd)),
      calls: num(d.call_count),
    }));
  const monthToDateUsd = dailyRows
    .filter((d) => d.usage_date >= monthStart)
    .reduce((sum, d) => sum + num(d.cost_usd), 0);

  const featureBreakdown = (
    (featuresRes.data ?? []) as Array<{
      feature: string;
      calls: unknown;
      errors: unknown;
      fallbacks: unknown;
      cache_hits: unknown;
      cost_usd: unknown;
      credits: unknown;
      latency_p50_ms: number | null;
      latency_p95_ms: number | null;
    }>
  )
    .map((f) => {
      const calls = num(f.calls);
      const errors = num(f.errors);
      return {
        feature: f.feature,
        costUsd: round4(num(f.cost_usd)),
        credits: Math.round(num(f.credits)),
        calls,
        errors,
        errorRatePct: ratio(errors, calls + errors),
        fallbackRatePct: ratio(num(f.fallbacks), calls),
        cacheHitRatePct: ratio(num(f.cache_hits), calls),
        latencyP50Ms: f.latency_p50_ms ?? null,
        latencyP95Ms: f.latency_p95_ms ?? null,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  const topSpenders = (topOrgsRes.data ?? []) as Array<{
    organization_id: string;
    calls: unknown;
    cost_usd: unknown;
    month_calls: unknown;
    today_calls: unknown;
  }>;
  const feedbackRows = (feedbackRes.data ?? []) as AssistantFeedbackRow[];
  const lookupOrgIds = Array.from(
    new Set([
      ...topSpenders.map((o) => o.organization_id),
      ...feedbackRows.filter((r) => r.rating === -1).map((r) => r.organization_id),
    ])
  );
  const topOrgIds = topSpenders.map((o) => o.organization_id);

  // Limits come from the resolver (override → profiles → plan → global), never a hard-coded default.
  const [resolvedLimits, orgsRes, orgSettingsRes] = await Promise.all([
    resolveOrgAiLimitsBatch(topOrgIds),
    lookupOrgIds.length > 0
      ? supabase.from('organizations').select('id, name, slug').in('id', lookupOrgIds)
      : Promise.resolve({ data: [], error: null }),
    topOrgIds.length > 0
      ? supabase
          .from('ai_platform_org_settings')
          .select('organization_id, enabled')
          .in('organization_id', topOrgIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const lookupError = orgsRes.error ?? orgSettingsRes.error ?? null;
  if (lookupError) return jsonError(req, lookupError.message, 500);

  const orgById = new Map(
    ((orgsRes.data ?? []) as Array<{ id: string; name: string; slug: string }>).map((o) => [
      o.id,
      { name: o.name, slug: o.slug },
    ])
  );
  const enabledByOrg = new Map(
    ((orgSettingsRes.data ?? []) as Array<{ organization_id: string; enabled: boolean }>).map(
      (s) => [s.organization_id, s.enabled !== false]
    )
  );

  const topOrgs = topSpenders.map((row) => {
    const orgId = row.organization_id;
    const org = orgById.get(orgId);
    const resolved = resolvedLimits.get(orgId);
    const dailyLimit = resolved ? limitNumber(resolved.limits, 'dailyCallLimit') : 0;
    const monthlyLimit = resolved ? limitNumber(resolved.limits, 'monthlyCallLimit') : 0;
    const todayCalls = num(row.today_calls);
    const monthCalls = num(row.month_calls);
    return {
      organizationId: orgId,
      organizationName: org?.name ?? 'Unknown org',
      organizationSlug: org?.slug ?? null,
      costUsd: round4(num(row.cost_usd)),
      calls: num(row.calls),
      aiEnabled: enabledByOrg.get(orgId) ?? true,
      profileCode: resolved?.orgProfileCode ?? resolved?.planProfileCode ?? null,
      hasOverrides: resolved?.hasOverrides ?? false,
      dailyLimit,
      monthlyLimit,
      todayCalls,
      monthCalls,
      overDaily: todayCalls > dailyLimit,
      overMonthly: monthCalls > monthlyLimit,
    };
  });

  const planUsage = summarizeUsageByPlan(
    (plansRes.data ?? []).map((p) => ({
      id: p.id as string,
      code: p.code as string,
      name: p.name as string,
      sortOrder: Number(p.sort_order ?? 0),
      monthlyCreditAllowance: parsePlanFeatures(p.features).aiMonthlyCreditAllowance,
    })),
    (planRollupRes.data ?? []) as PlanRollupRow[]
  );
  const marketingGenerations = summarizeMarketingGenerations(
    (jobsRollupRes.data ?? []) as GenerationRollupRow[]
  );

  const feedback = summarizeAssistantFeedback(
    feedbackRows,
    (orgId) => orgById.get(orgId)?.name ?? null
  );
  if (feedbackUpRes.count != null && feedbackDownRes.count != null) {
    const up = feedbackUpRes.count;
    const down = feedbackDownRes.count;
    feedback.up = up;
    feedback.down = down;
    feedback.positivePct = up + down === 0 ? null : Math.round((up / (up + down)) * 100);
  }

  const quotaBreaches = topOrgs.filter((o) => o.overDaily || o.overMonthly);
  const totalCostUsd = dailySeries.reduce((sum, d) => sum + d.costUsd, 0);
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const projectedMonthEndUsd = (monthToDateUsd / now.getUTCDate()) * daysInMonth;

  return jsonSuccess(req, {
    range,
    generatedAt: now.toISOString(),
    totals: {
      costUsd: Math.round(totalCostUsd * 100) / 100,
      calls: dailySeries.reduce((sum, d) => sum + d.calls, 0),
      credits: featureBreakdown.reduce((sum, f) => sum + f.credits, 0),
      orgsWithUsage: planUsage.reduce((sum, p) => sum + p.activeOrgs, 0),
      quotaBreaches: quotaBreaches.length,
      monthToDateUsd: Math.round(monthToDateUsd * 100) / 100,
      projectedMonthEndUsd: Math.round(projectedMonthEndUsd * 100) / 100,
      platformDailyCapUsd: platformDailyCostUsdCap(),
    },
    dailySeries,
    featureBreakdown,
    topOrgs,
    quotaBreaches,
    planUsage,
    marketingGenerations,
    assistantFeedback: feedback,
    // Best-effort: eval history is optional and must not break the cost console.
    assistantEvalRuns: evalRunsRes.error ? [] : (evalRunsRes.data ?? []).map(mapEvalRunRow),
  });
});
