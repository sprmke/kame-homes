import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  HealthCategory,
  HealthCheck,
  HealthStatus,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';
import {
  evaluateUiEnv,
  evaluateUiServerParity,
  readUiEnv,
} from '@/features/dashboard/super-admin/lib/systemHealth/uiEnvRegistry';

export type SystemHealthJob = {
  fn: string;
  label: string;
  features: string[];
  status: HealthStatus;
  detail: string;
  hint?: string;
  cronJobs: Array<{ name: string; schedule: string; active: boolean }>;
  expectedIntervalMinutes: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastStatus: 'ok' | 'error' | null;
  lastError: string | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  totalRuns: number;
  totalFailures: number;
  minutesSinceSuccess: number | null;
  logsHref?: string;
};

export type SystemHealthSummary = {
  environment: 'production' | 'non-production';
  generatedAt: string;
  overall: HealthStatus;
  categories: Record<
    Exclude<HealthCategory, 'usage'>,
    { status: HealthStatus; counts: Record<HealthStatus, number> }
  >;
  checks: HealthCheck[];
  jobs: SystemHealthJob[];
  sqlOnlyJobs: Array<{ name: string; schedule: string; active: boolean }>;
  probesLastRunAt: string | null;
  projectRef: string | null;
  vapidPublicKey: string | null;
};

export type SystemHealthCapacity = {
  db_size_bytes: number;
  tables: Array<{ name: string; bytes: number; approx_rows: number }>;
  buckets: Array<{ bucket: string; objects: number; bytes: number }> | null;
};

const FN = 'super-admin-system-health';

/** Server checks plus this build's Vite env and UI-vs-edge parity checks. */
export function allHealthChecks(summary: SystemHealthSummary): HealthCheck[] {
  const env = readUiEnv();
  return [
    ...summary.checks,
    ...evaluateUiEnv(env, summary.environment === 'production'),
    ...evaluateUiServerParity(env, {
      projectRef: summary.projectRef ?? null,
      vapidPublicKey: summary.vapidPublicKey ?? null,
    }),
  ];
}
const SUMMARY_KEY = ['super-admin', 'system-health', 'summary'] as const;

/** One DB read per fetch; no third-party calls. Refreshes every 2 minutes while open. */
export function useSystemHealth() {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => callEdgeFunction<SystemHealthSummary>(`${FN}?view=summary`),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useSystemHealthCapacity(enabled = true) {
  return useQuery({
    queryKey: ['super-admin', 'system-health', 'capacity'],
    queryFn: async () =>
      (await callEdgeFunction<{ capacity: SystemHealthCapacity }>(`${FN}?view=capacity`)).capacity,
    enabled,
    staleTime: 10 * 60_000,
  });
}

/**
 * Fire drill: sends one tagged event through the real edge capture path so an operator can
 * confirm that Sentry receives it with the release, environment and alert routing attached.
 */
export function useSendSentryTestError() {
  return useMutation({
    mutationFn: () =>
      callEdgeFunction<{ sent: boolean; runtime: string; elapsedMs: number }>(
        'super-admin-sentry-test',
        { method: 'POST', body: JSON.stringify({}) }
      ),
    onSuccess: () => toast.success('Test error sent'),
    onError: (error: Error) => toast.error(error.message || 'Could not send test error'),
  });
}

export function useRunHealthProbes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (probes?: string[]) =>
      callEdgeFunction<{ ran: string[]; throttled: string[]; checks: HealthCheck[] }>(FN, {
        method: 'POST',
        body: JSON.stringify({ action: 'run_probes', probes }),
      }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      if (result.ran.length === 0 && result.throttled.length > 0) {
        toast.message('Checked less than a minute ago');
        return;
      }
      const failing = result.checks.filter(
        (check) => result.ran.includes(check.probeId ?? '') && check.status === 'error'
      ).length;
      if (failing > 0) toast.error(`${failing} live check${failing === 1 ? '' : 's'} failing`);
      else toast.success('Live checks passed');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not run live checks'),
  });
}
