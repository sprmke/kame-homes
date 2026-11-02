/**
 * Free tier allows exactly one Sentry cron monitor (plan D13). A second one does not fail
 * loudly — Sentry starts dropping check-ins, and the monitor you thought was watching a job
 * simply is not. That silence is what this test prevents.
 *
 * The chosen job is `sd-refund-cron`: a missed refund run leaves a guest waiting for money
 * and no request fails. Every other scheduled job is covered by
 * `_shared/systemHealth/jobsRegistry.ts`, which costs nothing.
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

const FUNCTIONS_DIR = new URL('../', import.meta.url);

/** Functions allowed to send a Sentry check-in. Adding one means upgrading the plan. */
const MONITORED_CRONS = ['sd-refund-cron'];

async function functionFiles(): Promise<Array<{ name: string; source: string }>> {
  const out: Array<{ name: string; source: string }> = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory || entry.name.startsWith('_') || entry.name === 'tests') continue;
    try {
      const source = await Deno.readTextFile(new URL(`${entry.name}/index.ts`, FUNCTIONS_DIR));
      out.push({ name: entry.name, source });
    } catch {
      // No index.ts — not an edge function entry point.
    }
  }
  return out;
}

Deno.test('only the money-path cron sends sentry check-ins', async () => {
  const sending: string[] = [];

  for (const { name, source } of await functionFiles()) {
    const usesCheckIn =
      source.includes('sendCronCheckIn(') || source.includes('withCronCheckIn(');
    if (usesCheckIn) sending.push(name);
  }

  assertEquals(
    sending.sort(),
    [...MONITORED_CRONS].sort(),
    'Free tier allows one cron monitor. Upgrade the plan before adding another, or move the ' +
      'job to _shared/systemHealth/jobsRegistry.ts instead.'
  );
});

Deno.test('sd-refund-cron still declares its monitor', async () => {
  const source = await Deno.readTextFile(new URL('sd-refund-cron/index.ts', FUNCTIONS_DIR));
  assertEquals(source.includes("slug: 'sd-refund-cron'"), true);
  // A schedule that drifts from the pg_cron job makes a healthy scheduler look dead.
  assertEquals(source.includes("*/5 * * * *"), true);
});
