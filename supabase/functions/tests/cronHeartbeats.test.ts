/**
 * Source-contract tests for the raw `serve()` cron handlers.
 *
 * These three do not go through `serveCronPost`, so they never wrote
 * `system_job_heartbeats` and stayed Unknown on /admin/health. They now record
 * their unscoped cron runs, and must keep NOT recording scoped admin runs: a
 * manual "Sync now" or booking-scoped refund must never make a dead scheduler
 * look alive.
 */

import { assert, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const HANDLERS = [
  { dir: 'sd-refund-cron', job: 'sd-refund-cron', scopedFrom: 'cronRun = !scopedBookingId' },
  { dir: 'calendar-sync-cron', job: 'calendar-sync-cron', scopedFrom: 'cronRun = !scoped' },
  {
    dir: 'superhost-assessment-cron',
    job: 'superhost-assessment-cron',
    scopedFrom: 'cronRun = cronSecretOk',
  },
] as const;

async function source(dir: string): Promise<string> {
  return await Deno.readTextFile(new URL(`../${dir}/index.ts`, import.meta.url));
}

for (const { dir, job, scopedFrom } of HANDLERS) {
  Deno.test(`${job}: records a heartbeat only for the unscoped cron run`, async () => {
    const code = await source(dir);
    const flat = code.replace(/\s+/g, ' ');

    assertStringIncludes(code, "from '../_shared/systemHealth/jobHeartbeat.ts'");
    assertStringIncludes(flat, 'let cronRun = false');
    assertStringIncludes(flat, scopedFrom);

    assertStringIncludes(flat, `if (cronRun) { await recordJobHeartbeat('${job}', { ok: true`);
    assertStringIncludes(flat, `if (cronRun) { await recordJobHeartbeat('${job}', { ok: false`);
    assertStringIncludes(flat, 'startedAt: heartbeatStartedAt');
  });

  Deno.test(`${job}: the failure heartbeat carries the error`, async () => {
    const code = await source(dir);
    const callAt = code.indexOf(`recordJobHeartbeat('${job}'`);
    assert(callAt > 0, 'the handler should call recordJobHeartbeat');

    const failedAt = code.indexOf('ok: false', callAt);
    assert(failedAt > callAt, 'the handler should record a failed run');

    const block = code.slice(failedAt, failedAt + 200);
    assert(
      block.includes('error,') || block.includes('error: err'),
      'the failed-run heartbeat should include the error'
    );
  });
}
