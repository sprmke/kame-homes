import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  evaluateJobs,
  expectedIntervalMinutes,
  functionFromCronCommand,
  SCHEDULED_JOBS,
  vaultSecretName,
  type CronJobRow,
  type JobHeartbeatRow,
} from './jobsRegistry.ts';

Deno.test('expectedIntervalMinutes parses common schedules', () => {
  assertEquals(expectedIntervalMinutes('* * * * *'), 1);
  assertEquals(expectedIntervalMinutes('*/15 * * * *'), 15);
  assertEquals(expectedIntervalMinutes('0,30 * * * *'), 30);
  assertEquals(expectedIntervalMinutes('5 * * * *'), 60);
  assertEquals(expectedIntervalMinutes('0 */6 * * *'), 360);
  assertEquals(expectedIntervalMinutes('0 2 * * *'), 1440);
  assertEquals(expectedIntervalMinutes('0 3 * * 1'), 7 * 1440);
  assertEquals(expectedIntervalMinutes('0 0 1 * *'), 31 * 1440);
});

Deno.test('functionFromCronCommand extracts the edge function name', () => {
  assertEquals(
    functionFromCronCommand(
      "select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/sd-refund-cron')"
    ),
    'sd-refund-cron'
  );
  assertEquals(functionFromCronCommand('SELECT public.prune_rate_limits()'), null);
});

Deno.test('vaultSecretName lowercases the env key', () => {
  assertEquals(vaultSecretName('CALENDAR_SYNC_CRON_SECRET'), 'calendar_sync_cron_secret');
});

const now = new Date('2026-10-19T12:00:00Z');
const cron = (fn: string, schedule = '*/15 * * * *', active = true): CronJobRow => ({
  jobname: `${fn}-job`,
  schedule,
  active,
  command: `select net.http_post(url := 'x/functions/v1/${fn}')`,
});
const beat = (fn: string, overrides: Partial<JobHeartbeatRow> = {}): JobHeartbeatRow => ({
  job_name: fn,
  last_started_at: now.toISOString(),
  last_finished_at: now.toISOString(),
  last_success_at: new Date(now.getTime() - 5 * 60_000).toISOString(),
  last_failure_at: null,
  last_status: 'ok',
  last_error: null,
  last_duration_ms: 1200,
  consecutive_failures: 0,
  total_runs: 10,
  total_failures: 0,
  ...overrides,
});
const statusOf = (input: Parameters<typeof evaluateJobs>[0], fn: string) =>
  evaluateJobs(input).jobs.find((job) => job.fn === fn)!.status;

Deno.test('evaluateJobs: healthy job is ok', () => {
  assertEquals(
    statusOf(
      {
        cronJobs: [cron('sd-refund-cron')],
        heartbeats: [beat('sd-refund-cron')],
        isProd: true,
        now,
      },
      'sd-refund-cron'
    ),
    'ok'
  );
});

Deno.test('evaluateJobs: missing pg_cron is unknown', () => {
  assertEquals(
    statusOf({ cronJobs: null, heartbeats: [], isProd: true, now }, 'sd-refund-cron'),
    'unknown'
  );
});

Deno.test('evaluateJobs: unscheduled job warns in prod, off in dev', () => {
  assertEquals(
    statusOf({ cronJobs: [], heartbeats: [], isProd: true, now }, 'sd-refund-cron'),
    'warn'
  );
  assertEquals(
    statusOf({ cronJobs: [], heartbeats: [], isProd: false, now }, 'sd-refund-cron'),
    'off'
  );
  assertEquals(
    statusOf(
      {
        cronJobs: [cron('sd-refund-cron', '*/15 * * * *', false)],
        heartbeats: [],
        isProd: false,
        now,
      },
      'sd-refund-cron'
    ),
    'off'
  );
});

Deno.test('evaluateJobs: three consecutive failures is error', () => {
  assertEquals(
    statusOf(
      {
        cronJobs: [cron('sd-refund-cron')],
        heartbeats: [beat('sd-refund-cron', { last_status: 'error', consecutive_failures: 3 })],
        isProd: true,
        now,
      },
      'sd-refund-cron'
    ),
    'error'
  );
});

Deno.test('evaluateJobs: one failure warns, no heartbeat is unknown', () => {
  assertEquals(
    statusOf(
      {
        cronJobs: [cron('sd-refund-cron')],
        heartbeats: [beat('sd-refund-cron', { last_status: 'error', consecutive_failures: 1 })],
        isProd: true,
        now,
      },
      'sd-refund-cron'
    ),
    'warn'
  );
  assertEquals(
    statusOf(
      { cronJobs: [cron('sd-refund-cron')], heartbeats: [], isProd: true, now },
      'sd-refund-cron'
    ),
    'unknown'
  );
});

Deno.test('evaluateJobs: stale success warns after 2x interval + grace', () => {
  const stale = new Date(now.getTime() - 41 * 60_000).toISOString();
  const fresh = new Date(now.getTime() - 39 * 60_000).toISOString();
  const run = (lastSuccess: string) =>
    statusOf(
      {
        cronJobs: [cron('sd-refund-cron')],
        heartbeats: [beat('sd-refund-cron', { last_success_at: lastSuccess })],
        isProd: true,
        now,
      },
      'sd-refund-cron'
    );
  assertEquals(run(stale), 'warn');
  assertEquals(run(fresh), 'ok');
});

Deno.test('evaluateJobs: non-prod-only jobs are off in production', () => {
  const canary = SCHEDULED_JOBS.find((job) => job.nonProdOnly)!;
  assertEquals(statusOf({ cronJobs: [], heartbeats: [], isProd: true, now }, canary.fn), 'off');
});

Deno.test('evaluateJobs: SQL-only cron jobs are listed separately', () => {
  const sqlJob: CronJobRow = {
    jobname: 'prune',
    schedule: '0 3 * * *',
    active: true,
    command: 'select 1',
  };
  assertEquals(
    evaluateJobs({ cronJobs: [sqlJob], heartbeats: [], isProd: false, now }).sqlOnlyJobs,
    [{ name: 'prune', schedule: '0 3 * * *', active: true }]
  );
});
