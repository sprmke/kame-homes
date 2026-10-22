import { type HealthCheck, type HealthStatus } from './types.ts';

/**
 * Scheduled edge functions the platform expects to run. Matched against `cron.job` by the
 * `/functions/v1/<fn>` path inside the job command, so dynamically named jobs need no entry
 * here beyond the function itself. Vault secret name = lowercase `secretEnv`.
 */
export type ScheduledJobDef = {
  fn: string;
  label: string;
  secretEnv: string;
  features: string[];
  /** Runs only outside production (returns a skip there). */
  nonProdOnly?: boolean;
};

export const SCHEDULED_JOBS: ScheduledJobDef[] = [
  {
    fn: 'sd-refund-cron',
    label: 'SD refund emails',
    secretEnv: 'SD_REFUND_CRON_SECRET',
    features: ['Security deposit refunds'],
  },
  {
    fn: 'telegram-marketing-cron',
    label: 'Telegram marketing',
    secretEnv: 'TELEGRAM_CRON_SECRET',
    features: ['Telegram marketing'],
  },
  {
    fn: 'telegram-staff-cron',
    label: 'Telegram staff summary',
    secretEnv: 'TELEGRAM_STAFF_CRON_SECRET',
    features: ['Telegram staff alerts'],
  },
  {
    fn: 'telegram-admin-cron',
    label: 'Telegram admin alerts',
    secretEnv: 'TELEGRAM_ADMIN_CRON_SECRET',
    features: ['Telegram admin alerts'],
  },
  {
    fn: 'telegram-finance-cron',
    label: 'Telegram finance reminders',
    secretEnv: 'TELEGRAM_FINANCE_CRON_SECRET',
    features: ['Finance reminders'],
  },
  {
    fn: 'telegram-maintenance-cron',
    label: 'Telegram maintenance reminders',
    secretEnv: 'TELEGRAM_MAINTENANCE_CRON_SECRET',
    features: ['Maintenance reminders'],
  },
  {
    fn: 'expire-parking-broadcasts',
    label: 'Parking broadcast expiry',
    secretEnv: 'PARKING_BROADCAST_EXPIRE_CRON_SECRET',
    features: ['Parking requests'],
  },
  {
    fn: 'send-parking-reminders',
    label: 'Parking reminders',
    secretEnv: 'PARKING_REMINDER_CRON_SECRET',
    features: ['Parking reminders'],
  },
  {
    fn: 'contract-expiry-cron',
    label: 'Contract expiry',
    secretEnv: 'CONTRACT_EXPIRY_CRON_SECRET',
    features: ['Unit handoff contracts'],
  },
  {
    fn: 'dashboard-assistant-expire-pending-actions',
    label: 'Assistant action expiry',
    secretEnv: 'DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET',
    features: ['AI assistant'],
  },
  {
    fn: 'meta-inbox-webhook-healthcheck',
    label: 'Meta webhook check',
    secretEnv: 'META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET',
    features: ['Guest inbox'],
  },
  {
    fn: 'platform-billing-cron',
    label: 'Subscription billing',
    secretEnv: 'PLATFORM_BILLING_CRON_SECRET',
    features: ['Subscriptions'],
  },
  {
    fn: 'calendar-sync-cron',
    label: 'Calendar sync',
    secretEnv: 'CALENDAR_SYNC_CRON_SECRET',
    features: ['Calendar sync'],
  },
  {
    fn: 'smart-pricing-cron',
    label: 'Smart Pricing autopilot',
    secretEnv: 'SMART_PRICING_CRON_SECRET',
    features: ['Smart Pricing'],
  },
  {
    fn: 'superhost-assessment-cron',
    label: 'Superhost assessment',
    secretEnv: 'SUPERHOST_ASSESSMENT_CRON_SECRET',
    features: ['Superhost'],
  },
  {
    fn: 'analytics-ai-review-cron',
    label: 'Analytics AI review',
    secretEnv: 'ANALYTICS_AI_REVIEW_CRON_SECRET',
    features: ['Host analytics'],
  },
  {
    fn: 'property-page-views-prune-cron',
    label: 'Pageview prune',
    secretEnv: 'PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET',
    features: ['Host analytics'],
  },
  {
    fn: 'activity-log-retention-cron',
    label: 'Activity log retention',
    secretEnv: 'ACTIVITY_LOG_RETENTION_CRON_SECRET',
    features: ['Activity log'],
  },
  {
    fn: 'marketing-generation-sweeper',
    label: 'Marketing generation sweeper',
    secretEnv: 'MARKETING_GENERATION_CRON_SECRET',
    features: ['Marketing Studio'],
  },
  {
    fn: 'query-cache-sweep-cron',
    label: 'Query cache sweep',
    secretEnv: 'QUERY_CACHE_SWEEP_CRON_SECRET',
    features: ['Dashboard stats'],
  },
  {
    fn: 'voice-receptionist-reaper',
    label: 'Voice session reaper',
    secretEnv: 'VOICE_RECEPTIONIST_REAPER_SECRET',
    features: ['Voice receptionist'],
  },
  {
    fn: 'voice-receptionist-canary',
    label: 'Voice provider canary',
    secretEnv: 'VOICE_RECEPTIONIST_CANARY_SECRET',
    features: ['Voice receptionist'],
    nonProdOnly: true,
  },
  {
    fn: 'review-lifecycle-cron',
    label: 'Review lifecycle',
    secretEnv: 'REVIEW_LIFECYCLE_CRON_SECRET',
    features: ['Two-way reviews'],
  },
];

export function vaultSecretName(secretEnv: string): string {
  return secretEnv.toLowerCase();
}

/**
 * Approximate run interval for the cron shapes this repo uses. Unknown shapes fall back to
 * daily so staleness errs on the lenient side.
 */
export function expectedIntervalMinutes(schedule: string): number {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return 1440;
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  if (dayOfMonth !== '*') return 31 * 1440;
  if (dayOfWeek !== '*') return 7 * 1440;
  if (hour === '*') {
    if (minute === '*') return 1;
    const step = minute.match(/^\*\/(\d+)$/);
    if (step) return Math.max(1, Number(step[1]));
    if (minute.includes(',')) return Math.ceil(60 / minute.split(',').length);
    return 60;
  }
  const hourStep = hour.match(/^\*\/(\d+)$/);
  if (hourStep) return Math.max(1, Number(hourStep[1])) * 60;
  if (hour.includes(',')) return Math.ceil(1440 / hour.split(',').length);
  return 1440;
}

export function functionFromCronCommand(command: string): string | null {
  return command.match(/\/functions\/v1\/([a-z0-9-]+)/)?.[1] ?? null;
}

export type CronJobRow = { jobname: string; schedule: string; active: boolean; command: string };

export type JobHeartbeatRow = {
  job_name: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_status: 'ok' | 'error' | null;
  last_error: string | null;
  last_duration_ms: number | null;
  consecutive_failures: number;
  total_runs: number;
  total_failures: number;
};

export type JobHealthRow = {
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
  /** Supabase function logs, when the project ref is known. */
  logsHref?: string;
};

/** Consecutive failures that turn a job red. */
export const JOB_FAILURE_ERROR_THRESHOLD = 3;
const STALE_GRACE_MINUTES = 10;

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 2 * 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

export function evaluateJobs(input: {
  cronJobs: CronJobRow[] | null;
  heartbeats: JobHeartbeatRow[];
  isProd: boolean;
  now?: Date;
}): {
  jobs: JobHealthRow[];
  sqlOnlyJobs: Array<{ name: string; schedule: string; active: boolean }>;
} {
  const now = (input.now ?? new Date()).getTime();
  const cronByFn = new Map<string, CronJobRow[]>();
  const sqlOnlyJobs: Array<{ name: string; schedule: string; active: boolean }> = [];
  for (const job of input.cronJobs ?? []) {
    const fn = functionFromCronCommand(job.command);
    if (!fn) {
      sqlOnlyJobs.push({ name: job.jobname, schedule: job.schedule, active: job.active });
      continue;
    }
    cronByFn.set(fn, [...(cronByFn.get(fn) ?? []), job]);
  }
  const heartbeatByFn = new Map(input.heartbeats.map((row) => [row.job_name, row]));
  const cronAvailable = input.cronJobs !== null;

  const jobs = SCHEDULED_JOBS.map((def): JobHealthRow => {
    const crons = cronByFn.get(def.fn) ?? [];
    const activeCrons = crons.filter((job) => job.active);
    const heartbeat = heartbeatByFn.get(def.fn);
    const interval = activeCrons.length
      ? Math.min(...activeCrons.map((job) => expectedIntervalMinutes(job.schedule)))
      : null;
    const lastSuccessAt = heartbeat?.last_success_at ?? null;
    const minutesSinceSuccess = lastSuccessAt
      ? (now - new Date(lastSuccessAt).getTime()) / 60_000
      : null;

    const base = {
      fn: def.fn,
      label: def.label,
      features: def.features,
      cronJobs: crons.map((job) => ({
        name: job.jobname,
        schedule: job.schedule,
        active: job.active,
      })),
      expectedIntervalMinutes: interval,
      lastSuccessAt,
      lastFailureAt: heartbeat?.last_failure_at ?? null,
      lastStatus: heartbeat?.last_status ?? null,
      lastError: heartbeat?.last_error ?? null,
      lastDurationMs: heartbeat?.last_duration_ms ?? null,
      consecutiveFailures: heartbeat?.consecutive_failures ?? 0,
      totalRuns: heartbeat?.total_runs ?? 0,
      totalFailures: heartbeat?.total_failures ?? 0,
      minutesSinceSuccess,
    };

    if (def.nonProdOnly && input.isProd) {
      return { ...base, status: 'off', detail: 'Not used in production' };
    }
    if (!cronAvailable) {
      return { ...base, status: 'unknown', detail: 'pg_cron not available' };
    }
    if (activeCrons.length === 0) {
      return {
        ...base,
        status: input.isProd ? 'warn' : 'off',
        detail: crons.length ? 'Cron job paused' : 'Not scheduled',
        hint: `Run SELECT public.sync_*_cron_job() for ${def.fn} after Vault secrets are set.`,
      };
    }
    if (base.consecutiveFailures >= JOB_FAILURE_ERROR_THRESHOLD) {
      return {
        ...base,
        status: 'error',
        detail: `Failed ${base.consecutiveFailures} runs in a row`,
        hint: 'Check the edge function logs for this job.',
      };
    }
    if (!heartbeat) {
      return { ...base, status: 'unknown', detail: 'No runs recorded yet' };
    }
    if (heartbeat.last_status === 'error') {
      return {
        ...base,
        status: 'warn',
        detail: 'Last run failed',
        hint: 'Check the edge function logs for this job.',
      };
    }
    const allowed = interval! * 2 + STALE_GRACE_MINUTES;
    if (minutesSinceSuccess === null || minutesSinceSuccess > allowed) {
      return {
        ...base,
        status: 'warn',
        detail:
          minutesSinceSuccess === null
            ? 'Never succeeded'
            : `Last success ${formatMinutes(minutesSinceSuccess)} ago (every ${formatMinutes(interval!)})`,
        hint: 'Requests may be rejected (401). Compare the Vault and edge secret for this job.',
      };
    }
    return {
      ...base,
      status: 'ok',
      detail: `Last success ${formatMinutes(minutesSinceSuccess)} ago`,
    };
  });

  return { jobs, sqlOnlyJobs };
}

export function jobsToChecks(jobs: JobHealthRow[]): HealthCheck[] {
  return jobs.map((job) => ({
    id: `job.${job.fn}`,
    category: 'jobs',
    group: 'Scheduled jobs',
    label: job.label,
    status: job.status,
    detail: job.detail,
    hint: job.hint,
    features: job.features,
    manageHref: job.status === 'error' || job.status === 'warn' ? job.logsHref : undefined,
  }));
}
