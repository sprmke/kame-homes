/**
 * Cron check-in tests. No network: `fetch` is stubbed so the envelope is inspected.
 *
 * The free tier has one monitor, so the guard that matters most is "only the money-path
 * cron declares one" — a second check-in starts getting dropped without any error.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { resetSentryCronDsnForTests, sendCronCheckIn, withCronCheckIn } from './sentryCron.ts';

const DSN = 'https://publickey@o1.ingest.us.sentry.io/4512354438021120';

type Captured = { url: string; body: string };

let captured: Captured[] = [];
const originalFetch = globalThis.fetch;

function install(): void {
  captured = [];
  Deno.env.set('SENTRY_DSN', DSN);
  resetSentryCronDsnForTests();
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), body: String(init?.body ?? '') });
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as typeof fetch;
}

function restore(): void {
  globalThis.fetch = originalFetch;
  Deno.env.delete('SENTRY_DSN');
  resetSentryCronDsnForTests();
}

function parseCheckIn(body: string): Record<string, unknown> {
  const lines = body.split('\n').filter((line) => line.trim());
  return JSON.parse(lines[2]!) as Record<string, unknown>;
}

const MONITOR = {
  slug: 'sd-refund-cron',
  schedule: '*/5 * * * *',
  timezone: 'Asia/Manila',
  maxRuntimeMinutes: 10,
};

Deno.test('sends an in-progress check-in with a monitor config', async () => {
  install();
  try {
    await sendCronCheckIn(MONITOR, 'in_progress');

    assertEquals(captured.length, 1);
    assertEquals(
      captured[0]!.url,
      'https://o1.ingest.us.sentry.io/api/4512354438021120/envelope/'
    );

    const payload = parseCheckIn(captured[0]!.body);
    assertEquals(payload.monitor_slug, 'sd-refund-cron');
    assertEquals(payload.status, 'in_progress');

    const config = payload.monitor_config as {
      schedule: { type: string; value: string };
      timezone: string;
      max_runtime: number;
    };
    assertEquals(config.schedule.value, '*/5 * * * *');
    assertEquals(config.timezone, 'Asia/Manila');
    assertEquals(config.max_runtime, 10);
  } finally {
    restore();
  }
});

Deno.test('ok and error check-ins carry a duration and no monitor config', async () => {
  install();
  try {
    await sendCronCheckIn(MONITOR, 'ok', { durationMs: 4200 });

    const payload = parseCheckIn(captured[0]!.body);
    assertEquals(payload.status, 'ok');
    // Sentry expects seconds.
    assertEquals(payload.duration, 4.2);
    assertEquals('monitor_config' in payload, false);
  } finally {
    restore();
  }
});

Deno.test('withCronCheckIn reports ok on success and rethrows on failure', async () => {
  install();
  try {
    const value = await withCronCheckIn(MONITOR, () => Promise.resolve('done'));
    assertEquals(value, 'done');
    assertEquals(captured.length, 2);
    assertEquals(parseCheckIn(captured[0]!.body).status, 'in_progress');
    assertEquals(parseCheckIn(captured[1]!.body).status, 'ok');
  } finally {
    restore();
  }
});

Deno.test('withCronCheckIn reports error and still rethrows', async () => {
  install();
  try {
    let threw = false;
    try {
      await withCronCheckIn(MONITOR, () => Promise.reject(new Error('sweep died')));
    } catch {
      threw = true;
    }
    assert(threw, 'the caller must still see the failure');
    assertEquals(captured.length, 2);
    assertEquals(parseCheckIn(captured[1]!.body).status, 'error');
  } finally {
    restore();
  }
});

Deno.test('no-ops without a DSN so a monitor can never fail the job', async () => {
  install();
  try {
    Deno.env.delete('SENTRY_DSN');
    resetSentryCronDsnForTests();
    await sendCronCheckIn(MONITOR, 'in_progress');
    assertEquals(captured.length, 0);
  } finally {
    restore();
  }
});

Deno.test('a rejected check-in never throws', async () => {
  install();
  try {
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    await sendCronCheckIn(MONITOR, 'ok');
  } finally {
    restore();
  }
});
