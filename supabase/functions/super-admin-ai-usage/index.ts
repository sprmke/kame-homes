/**
 * super-admin-ai-usage — GET the platform AI cost console for `/admin/ai-usage`.
 * Daily spend trend + cost/credits by feature + usage by plan + Marketing Studio job
 * outcomes + top orgs by spend + current quota breaches.
 * Also: assistant feedback + the latest assistant golden eval runs (per-module pass rates).
 * Read-only, super-admin only. Backs the numbers `super-admin-overview` only summarizes.
 */

import { limitNumber, resolveOrgAiLimitsBatch } from '../_shared/aiLimitResolver.ts';
import { platformDailyCostUsdCap } from '../_shared/aiUsageService.ts';
import {
  summarizeMarketingGenerations,
  summarizeUsageByPlan,
  type ConsoleGenerationJob,
  type ConsoleUsageEvent,
} from '../_shared/aiUsageConsoleSummary.ts';
import { mapEvalRunRow } from '../_shared/assistantEvalSummary.ts';
import { parsePlanFeatures } from '../_shared/planFeatures.ts';
import {
  summarizeAssistantFeedback,
  type AssistantFeedbackRow,
} from '../_shared/assistantFeedbackSummary.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

const RANGE_DAYS: Record<string, number> = { '30d': 30, '90d': 90, '12mo': 365 };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

serveSuperAdmin('super-admin-ai-usage', async (req) => {
  requireHttpMethod(req, 'GET');
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? '30d';
  const days = RANGE_DAYS[range] ?? 30;
  const now = new Date();
  const sinceDate = isoDate(new Date(now.getTime() - days * 86_400_000));
  const sinceIso = new Date(now.getTime() - days * 86_400_000).toISOString();
  const monthStart = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const today = isoDate(now);

  const [
    dailyRes,
    eventsRes,
    orgSettingsRes,
    monthRes,
    orgsRes,
    feedbackRes,
    evalRunsRes,
    plansRes,
    subscriptionsRes,
    jobsRes,
  ] = await Promise.all([
    supabase
      .from('ai_platform_usage_daily')
      .select('usage_date, call_count, estimated_cost_usd, organization_id')
      .gte('usage_date', sinceDate)
      .limit(100_000),
    supabase
      .from('ai_platform_usage_events')
      .select(
        'feature, estimated_cost_usd, credits_consumed, organization_id, status, latency_ms, fallback_used, cache_hit'
      )
      .gte('created_at', sinceIso)
      .limit(100_000),
    supabase.from('ai_platform_org_settings').select('organization_id, enabled'),
    supabase
      .from('ai_platform_usage_daily')
      .select('organization_id, estimated_cost_usd, credits_consumed')
      .gte('usage_date', monthStart)
      .limit(100_000),
    supabase.from('organizations').select('id, name, slug').limit(10_000),
    supabase
      .from('ai_dashboard_assistant_feedback')
      .select('rating, reason, created_at, organization_id')
      .gte('created_at', sinceIso)
      .limit(20_000),
    supabase
      .from('ai_assistant_eval_runs')
      .select(
        'id, created_at, routed, passed, total, avg_tools_sent, prompt_version, modules, failed_case_ids'
      )
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('pricing_plans')
      .select('id, code, name, sort_order, is_default, features')
      .eq('is_active', true),
    supabase
      .from('org_subscriptions')
      .select('organization_id, plan_id')
      .in('status', ['active', 'trialing', 'past_due', 'suspended'])
      .limit(10_000),
    supabase
      .from('marketing_generation_jobs')
      .select(
        'media_type, quality_tier, resolution, job_status, error_code, credits_consumed, estimated_cost_usd, usage_recorded_at, created_at, completed_at'
      )
      .gte('created_at', sinceIso)
      .limit(50_000),
  ]);

  const firstError =
    dailyRes.error ??
    eventsRes.error ??
    orgSettingsRes.error ??
    monthRes.error ??
    orgsRes.error ??
    feedbackRes.error ??
    plansRes.error ??
    subscriptionsRes.error ??
    jobsRes.error ??
    null;
  if (firstError) return jsonError(req, firstError.message, 500);

  const orgById = new Map(
    (orgsRes.data ?? []).map((o) => [
      o.id as string,
      { name: o.name as string, slug: o.slug as string },
    ])
  );
  const enabledByOrg = new Map(
    (orgSettingsRes.data ?? []).map((s) => [s.organization_id as string, s.enabled !== false])
  );

  // Daily spend/calls trend (platform-wide)
  const byDate = new Map<string, { costUsd: number; calls: number }>();
  for (const row of dailyRes.data ?? []) {
    const key = row.usage_date as string;
    const bucket = byDate.get(key) ?? { costUsd: 0, calls: 0 };
    bucket.costUsd += Number(row.estimated_cost_usd ?? 0);
    bucket.calls += Number(row.call_count ?? 0);
    byDate.set(key, bucket);
  }
  const dailySeries = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      costUsd: Math.round(v.costUsd * 10_000) / 10_000,
      calls: v.calls,
    }));

  // Cost + reliability by feature (gateway trace columns: status, latency_ms, fallback_used).
  type FeatureBucket = {
    costUsd: number;
    credits: number;
    calls: number;
    errors: number;
    fallbacks: number;
    cacheHits: number;
    latencies: number[];
  };
  const byFeature = new Map<string, FeatureBucket>();
  for (const ev of eventsRes.data ?? []) {
    const feature = (ev.feature as string) || 'other';
    const bucket = byFeature.get(feature) ?? {
      costUsd: 0,
      credits: 0,
      calls: 0,
      errors: 0,
      fallbacks: 0,
      cacheHits: 0,
      latencies: [],
    };
    if (ev.status === 'error') {
      bucket.errors += 1;
    } else {
      bucket.calls += 1;
      bucket.costUsd += Number(ev.estimated_cost_usd ?? 0);
      bucket.credits += Number(ev.credits_consumed ?? 0);
      if (ev.fallback_used === true) bucket.fallbacks += 1;
      if (ev.cache_hit === true) bucket.cacheHits += 1;
      const latency = Number(ev.latency_ms);
      if (Number.isFinite(latency) && latency > 0) bucket.latencies.push(latency);
    }
    byFeature.set(feature, bucket);
  }
  const percentile = (sorted: number[], p: number): number | null =>
    sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const ratio = (part: number, whole: number): number =>
    whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
  const featureBreakdown = Array.from(byFeature.entries())
    .map(([feature, v]) => {
      const sorted = [...v.latencies].sort((a, b) => a - b);
      return {
        feature,
        costUsd: Math.round(v.costUsd * 10_000) / 10_000,
        credits: v.credits,
        calls: v.calls,
        errors: v.errors,
        errorRatePct: ratio(v.errors, v.calls + v.errors),
        fallbackRatePct: ratio(v.fallbacks, v.calls),
        cacheHitRatePct: ratio(v.cacheHits, v.calls),
        latencyP50Ms: percentile(sorted, 0.5),
        latencyP95Ms: percentile(sorted, 0.95),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  // Spend by org (from events — has org_id) + this-month day counts from daily rows
  const byOrg = new Map<string, { costUsd: number; calls: number }>();
  for (const ev of eventsRes.data ?? []) {
    const orgId = ev.organization_id as string;
    if (!orgId || ev.status === 'error') continue;
    const bucket = byOrg.get(orgId) ?? { costUsd: 0, calls: 0 };
    bucket.costUsd += Number(ev.estimated_cost_usd ?? 0);
    bucket.calls += 1;
    byOrg.set(orgId, bucket);
  }

  const monthCallsByOrg = new Map<string, number>();
  const todayCallsByOrg = new Map<string, number>();
  for (const row of dailyRes.data ?? []) {
    const orgId = row.organization_id as string;
    const date = row.usage_date as string;
    const calls = Number(row.call_count ?? 0);
    if (date >= monthStart) monthCallsByOrg.set(orgId, (monthCallsByOrg.get(orgId) ?? 0) + calls);
    if (date === today) todayCallsByOrg.set(orgId, calls);
  }

  const topSpenders = Array.from(byOrg.entries())
    .sort((a, b) => b[1].costUsd - a[1].costUsd)
    .slice(0, 25);
  // Limits come from the resolver (override → profiles → plan → global), never a hard-coded default.
  const resolvedLimits = await resolveOrgAiLimitsBatch(topSpenders.map(([orgId]) => orgId));

  const topOrgs = topSpenders.map(([orgId, v]) => {
    const org = orgById.get(orgId);
    const resolved = resolvedLimits.get(orgId);
    const dailyLimit = resolved ? limitNumber(resolved.limits, 'dailyCallLimit') : 0;
    const monthlyLimit = resolved ? limitNumber(resolved.limits, 'monthlyCallLimit') : 0;
    const todayCalls = todayCallsByOrg.get(orgId) ?? 0;
    const monthCalls = monthCallsByOrg.get(orgId) ?? 0;
    return {
      organizationId: orgId,
      organizationName: org?.name ?? 'Unknown org',
      organizationSlug: org?.slug ?? null,
      costUsd: Math.round(v.costUsd * 10_000) / 10_000,
      calls: v.calls,
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

  const quotaBreaches = topOrgs.filter((o) => o.overDaily || o.overMonthly);
  const totalCostUsd = dailySeries.reduce((sum, d) => sum + d.costUsd, 0);
  const monthToDateUsd = (monthRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
    0
  );
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const projectedMonthEndUsd = (monthToDateUsd / now.getUTCDate()) * daysInMonth;
  const totalCalls = dailySeries.reduce((sum, d) => sum + d.calls, 0);
  const totalCredits = featureBreakdown.reduce((sum, f) => sum + f.credits, 0);

  const monthCreditsByOrg = new Map<string, number>();
  for (const row of monthRes.data ?? []) {
    const orgId = row.organization_id as string;
    monthCreditsByOrg.set(
      orgId,
      (monthCreditsByOrg.get(orgId) ?? 0) + Number(row.credits_consumed ?? 0)
    );
  }
  const planUsage = summarizeUsageByPlan({
    plans: (plansRes.data ?? []).map((p) => ({
      id: p.id as string,
      code: p.code as string,
      name: p.name as string,
      sortOrder: Number(p.sort_order ?? 0),
      isDefault: p.is_default === true,
      monthlyCreditAllowance: parsePlanFeatures(p.features).aiMonthlyCreditAllowance,
    })),
    orgIds: Array.from(orgById.keys()),
    planIdByOrg: new Map(
      (subscriptionsRes.data ?? []).map((s) => [s.organization_id as string, s.plan_id as string])
    ),
    events: (eventsRes.data ?? []) as ConsoleUsageEvent[],
    monthCreditsByOrg,
  });
  const marketingGenerations = summarizeMarketingGenerations(
    (jobsRes.data ?? []) as ConsoleGenerationJob[],
    now
  );

  return jsonSuccess(req, {
    range,
    generatedAt: now.toISOString(),
    totals: {
      costUsd: Math.round(totalCostUsd * 100) / 100,
      calls: totalCalls,
      credits: totalCredits,
      orgsWithUsage: byOrg.size,
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
    assistantFeedback: summarizeAssistantFeedback(
      (feedbackRes.data ?? []) as AssistantFeedbackRow[],
      (orgId) => orgById.get(orgId)?.name ?? null
    ),
    // Best-effort: eval history is optional and must not break the cost console.
    assistantEvalRuns: evalRunsRes.error ? [] : (evalRunsRes.data ?? []).map(mapEvalRunRow),
  });
});
