/**
 * super-admin-system-health — backs `/admin/health/*` (see docs/guides/routes/admin/health.md).
 *
 * GET ?view=summary (default): env + posture checks, DB prerequisites, Vault parity, job
 *   heartbeats vs pg_cron schedules, tenant integration counters, and cached live probes.
 *   One RPC + in-memory env reads. Never calls a third party.
 * GET ?view=capacity: database size, largest tables, storage buckets (heavier; Usage tab only).
 * POST { action: 'run_probes', probes?: string[] }: runs live credential checks against free
 *   metadata endpoints (throttled 60s per probe). Read-only, so no step-up and no audit row.
 *
 * Secret values are never returned: env checks report presence, counts, or validation only.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { evaluateEdgeEnv } from '../_shared/systemHealth/envRegistry.ts';
import { evaluateJobs, jobsToChecks } from '../_shared/systemHealth/jobsRegistry.ts';
import { PROBES, probesToChecks, runProbes } from '../_shared/systemHealth/probes.ts';
import {
  evaluateAiProviders,
  evaluateDatabase,
  evaluateEmailTraffic,
  evaluatePayments,
  evaluatePlatformPosture,
  evaluateTenantIntegrations,
  type SystemHealthSnapshot,
} from '../_shared/systemHealth/snapshotChecks.ts';
import {
  isProductionEnv,
  supabaseDashboardUrl,
  supabaseProjectRef,
  worstStatus,
  type HealthCategory,
  type HealthCheck,
  type HealthStatus,
} from '../_shared/systemHealth/types.ts';

const CATEGORIES: HealthCategory[] = [
  'configuration',
  'security',
  'integrations',
  'jobs',
  'database',
];

const getEnv = (key: string) => Deno.env.get(key);

/** Public half of VAPID_KEYS (safe to return; the UI compares it with its build key). */
function vapidPublicKey(get: typeof getEnv): string | null {
  try {
    const parsed = JSON.parse(get('VAPID_KEYS') ?? '') as { publicKey?: unknown };
    return typeof parsed.publicKey === 'string' ? parsed.publicKey : null;
  } catch {
    return null;
  }
}

function summarize(checks: HealthCheck[]) {
  const categories = Object.fromEntries(
    CATEGORIES.map((category) => {
      const inCategory = checks.filter((check) => check.category === category);
      const counts: Record<HealthStatus, number> = { ok: 0, warn: 0, error: 0, off: 0, unknown: 0 };
      for (const check of inCategory) counts[check.status]++;
      return [category, { status: worstStatus(inCategory.map((c) => c.status)), counts }];
    })
  );
  return { overall: worstStatus(checks.map((check) => check.status)), categories };
}

serveSuperAdmin('super-admin-system-health', async (req) => {
  const supabase = createServiceClient();
  const isProd = isProductionEnv(getEnv);

  if (req.method === 'GET') {
    const view = new URL(req.url).searchParams.get('view') ?? 'summary';

    if (view === 'capacity') {
      const { data, error } = await supabase.rpc('get_system_health_capacity');
      if (error) return jsonError(req, error.message, 500);
      return jsonSuccess(req, { capacity: data });
    }

    if (view !== 'summary') return jsonError(req, 'Unknown view', 400);

    const { data, error } = await supabase.rpc('get_system_health_snapshot');
    if (error) return jsonError(req, error.message, 500);
    const snapshot = data as SystemHealthSnapshot;

    const projectRef = supabaseProjectRef(getEnv);
    const evaluated = evaluateJobs({
      cronJobs: snapshot.cron_jobs,
      heartbeats: snapshot.heartbeats ?? [],
      isProd,
    });
    const jobs = evaluated.jobs.map((job) => ({
      ...job,
      logsHref: supabaseDashboardUrl(projectRef, `functions/${job.fn}/logs`),
    }));

    const checks: HealthCheck[] = [
      ...evaluateEdgeEnv(getEnv, isProd),
      ...evaluatePlatformPosture(snapshot, isProd),
      ...evaluateDatabase(snapshot, getEnv, isProd),
      ...jobsToChecks(jobs),
      ...probesToChecks(getEnv, snapshot.probes ?? []),
      ...evaluateAiProviders(snapshot),
      ...evaluateEmailTraffic(snapshot, getEnv),
      ...evaluatePayments(snapshot, getEnv),
      ...evaluateTenantIntegrations(snapshot, isProd),
    ];

    const probesLastRunAt =
      (snapshot.probes ?? [])
        .map((p) => p.checked_at)
        .sort()
        .at(-1) ?? null;

    return jsonSuccess(req, {
      environment: isProd ? 'production' : 'non-production',
      generatedAt: new Date().toISOString(),
      ...summarize(checks),
      checks,
      jobs,
      sqlOnlyJobs: evaluated.sqlOnlyJobs,
      probesLastRunAt,
      projectRef,
      vapidPublicKey: vapidPublicKey(getEnv),
    });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.action !== 'run_probes') return jsonError(req, 'Unknown action', 400);
    const known = new Set(PROBES.map((probe) => probe.id));
    const requested = Array.isArray(body.probes)
      ? body.probes.filter((id): id is string => typeof id === 'string' && known.has(id))
      : undefined;
    const { results, ran, throttled } = await runProbes({ get: getEnv, supabase }, requested);
    return jsonSuccess(req, {
      ran,
      throttled,
      checks: probesToChecks(getEnv, results),
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
