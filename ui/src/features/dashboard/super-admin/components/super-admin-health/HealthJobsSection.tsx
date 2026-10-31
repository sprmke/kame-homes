import { useMemo } from 'react';

import { ExternalLink } from 'lucide-react';

import { HealthCheckList } from '@/features/dashboard/super-admin/components/super-admin-health/HealthCheckList';
import {
  HealthStatusBadge,
  HealthStatusDot,
} from '@/features/dashboard/super-admin/components/super-admin-health/HealthStatusBadge';
import type {
  SystemHealthJob,
  SystemHealthSummary,
} from '@/features/dashboard/super-admin/hooks/useSystemHealth';
import {
  formatAgo,
  HEALTH_STATUS_META,
  healthCheckAnchor,
  sortChecks,
  worstStatus,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

import { STATUS_TONE_HEX } from '@/lib/statusToneColors';

/** Mirrors the edge staleness rule: 2x the schedule interval plus 10 minutes. */
function staleBudgetMinutes(job: SystemHealthJob): number | null {
  return job.expectedIntervalMinutes === null ? null : job.expectedIntervalMinutes * 2 + 10;
}

function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function JobRow({ job }: { job: SystemHealthJob }) {
  const budget = staleBudgetMinutes(job);
  const pct =
    budget && job.minutesSinceSuccess !== null
      ? Math.min(100, (job.minutesSinceSuccess / budget) * 100)
      : null;
  const schedules = job.cronJobs.filter((c) => c.active).map((c) => c.schedule);

  return (
    <li
      id={healthCheckAnchor(`job.${job.fn}`)}
      className="scroll-mt-28 space-y-1.5 px-3 py-2.5 transition-colors data-[highlight=true]:bg-amber-50 dark:data-[highlight=true]:bg-amber-950/30"
    >
      <div className="flex items-start gap-2.5">
        <HealthStatusDot status={job.status} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-sm font-medium">{job.label}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {job.lastSuccessAt ? `OK ${formatAgo(job.lastSuccessAt)}` : 'No success yet'}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">{job.detail}</p>
          {job.hint && (job.status === 'warn' || job.status === 'error') ? (
            <p
              className={
                job.status === 'error'
                  ? 'text-xs text-rose-700 dark:text-rose-300'
                  : 'text-xs text-amber-800 dark:text-amber-200'
              }
            >
              {job.hint}
            </p>
          ) : null}
          {job.lastStatus === 'error' && job.lastError ? (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 break-all font-mono text-[11px]">
              {job.lastError}
            </p>
          ) : null}
        </div>
      </div>
      {pct !== null ? (
        <div className="bg-muted ml-[18px] h-1 overflow-hidden rounded-full" aria-hidden>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(pct, 2)}%`,
              background: STATUS_TONE_HEX[HEALTH_STATUS_META[job.status].tone],
            }}
          />
        </div>
      ) : null}
      <p className="text-muted-foreground ml-[18px] flex flex-wrap gap-x-3 text-[11px] tabular-nums">
        <span className="font-mono">{job.fn}</span>
        {schedules.length ? (
          <span>Every {formatInterval(job.expectedIntervalMinutes ?? 0)}</span>
        ) : null}
        {job.totalRuns ? (
          <span>
            {job.totalRuns} runs · {job.totalFailures} failed
          </span>
        ) : null}
        {job.lastDurationMs !== null ? (
          <span>{(job.lastDurationMs / 1000).toFixed(1)}s</span>
        ) : null}
      </p>
      {job.logsHref && (job.status === 'error' || job.status === 'warn') ? (
        <a
          href={job.logsHref}
          target="_blank"
          rel="noreferrer"
          className="text-primary ml-[18px] inline-flex min-h-[44px] items-center gap-1 text-xs font-medium hover:underline lg:min-h-7"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Logs
        </a>
      ) : null}
    </li>
  );
}

export function HealthJobsSection({ summary }: { summary: SystemHealthSummary }) {
  const jobs = useMemo(() => sortChecks(summary.jobs), [summary.jobs]);
  const databaseChecks = useMemo(
    () => summary.checks.filter((check) => check.category === 'database'),
    [summary.checks]
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="surface-card min-w-0 overflow-hidden" aria-label="Scheduled jobs">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-card-title">Scheduled jobs</h2>
          <HealthStatusBadge status={worstStatus(jobs.map((job) => job.status))} />
        </header>
        <ul className="divide-border/60 divide-y">
          {jobs.map((job) => (
            <JobRow key={job.fn} job={job} />
          ))}
        </ul>
      </section>

      <HealthCheckList checks={databaseChecks} showFilter={false} />

      {summary.sqlOnlyJobs.length > 0 ? (
        <section className="surface-card min-w-0 overflow-hidden" aria-label="SQL jobs">
          <header className="border-b px-3 py-2">
            <h2 className="text-card-title">SQL jobs</h2>
          </header>
          <ul className="divide-border/60 divide-y">
            {summary.sqlOnlyJobs.map((job) => (
              <li
                key={job.name}
                className="flex min-h-[44px] items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-all font-mono text-[13px]">{job.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {job.active ? job.schedule : 'Paused'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
