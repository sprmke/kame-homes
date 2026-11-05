import { evaluateEdgeEnv } from './envRegistry.ts';
import { evaluateJobs, jobsToChecks } from './jobsRegistry.ts';
import { probesToChecks } from './probes.ts';
import {
  evaluateAiProviders,
  evaluateDatabase,
  evaluateEmailTraffic,
  evaluatePayments,
  evaluatePlatformPosture,
  evaluateTenantIntegrations,
  type SystemHealthSnapshot,
} from './snapshotChecks.ts';
import { supabaseDashboardUrl, supabaseProjectRef, type HealthCheck } from './types.ts';

export type SystemHealthChecks = {
  checks: HealthCheck[];
  jobs: ReturnType<typeof evaluateJobs>['jobs'];
  sqlOnlyJobs: ReturnType<typeof evaluateJobs>['sqlOnlyJobs'];
  projectRef: string | null;
};

/**
 * Single source of truth for the health checks shown at `/admin/health` and embedded in
 * the weekly operations report. Keep the ordering stable so a report diff is meaningful.
 */
export function collectSystemHealthChecks(input: {
  snapshot: SystemHealthSnapshot;
  get: (key: string) => string | undefined;
  isProd: boolean;
}): SystemHealthChecks {
  const { snapshot, get, isProd } = input;
  const projectRef = supabaseProjectRef(get);
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
    ...evaluateEdgeEnv(get, isProd),
    ...evaluatePlatformPosture(snapshot, isProd),
    ...evaluateDatabase(snapshot, get, isProd),
    ...jobsToChecks(jobs),
    ...probesToChecks(get, snapshot.probes ?? []),
    ...evaluateAiProviders(snapshot),
    ...evaluateEmailTraffic(snapshot, get),
    ...evaluatePayments(snapshot, get),
    ...evaluateTenantIntegrations(snapshot, isProd),
  ];

  return { checks, jobs, sqlOnlyJobs: evaluated.sqlOnlyJobs, projectRef };
}
