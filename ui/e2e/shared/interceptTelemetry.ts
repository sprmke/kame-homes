import type { Page } from '@playwright/test';

/**
 * Blocks every telemetry request a browser test could make, and records the attempts.
 *
 * Why this exists: analytics and error capture are fire-and-forget, so a test that trips
 * them still passes. That means CI quietly writes synthetic events into PostHog and
 * synthetic exceptions into Sentry — polluting the two datasets we are trying to trust. The
 * guards in `scripts/dev` prove the code cannot *call* PostHog exceptions; this proves a
 * browser run does not *send* anything either.
 *
 * Empty DSNs (`VITE_POSTHOG_KEY` / `VITE_SENTRY_DSN`) already disable both clients in CI, so
 * this is defence in depth: it also catches a spec that injects a fake DSN to exercise the
 * SDK, which is exactly the case that would otherwise leak.
 *
 * Usage:
 *   const attempts = await installTelemetryIntercepts(page);
 *   await page.goto('/');
 *   expect(attempts()).toEqual([]);
 */

/** Every host a telemetry request can reach, including the first-party `/ingest` rewrite. */
const TELEMETRY_PATTERNS = [
  '**/ingest/**',
  '**/*.posthog.com/**',
  '**/e/**', // posthog-js capture endpoint on a custom host
  '**/*.ingest.sentry.io/**',
  '**/api/*/envelope/**',
  '**/monitoring/**',
] as const;

export type TelemetryAttempt = {
  url: string;
  kind: 'posthog' | 'sentry';
  method: string;
};

function classify(url: string): TelemetryAttempt['kind'] | null {
  if (/posthog|\/ingest\/|\/e\/\?/i.test(url)) return 'posthog';
  if (/sentry|\/envelope\/|\/monitoring\//i.test(url)) return 'sentry';
  return null;
}

/**
 * Installs the intercepts and returns a reader for what was blocked. Call before `goto`.
 */
export async function installTelemetryIntercepts(page: Page): Promise<() => TelemetryAttempt[]> {
  const attempts: TelemetryAttempt[] = [];

  for (const pattern of TELEMETRY_PATTERNS) {
    await page.route(pattern, async (route) => {
      const request = route.request();
      const kind = classify(request.url());
      if (kind) {
        attempts.push({ url: request.url(), kind, method: request.method() });
      }
      // Abort rather than fulfil: a fulfilled response would let the SDK believe it
      // succeeded and skip its retry/backoff paths, which is the opposite of a test.
      await route.abort('blockedbyclient');
    });
  }

  return () => attempts;
}

/** Convenience for a spec that only wants to assert nothing escaped. */
export async function expectNoTelemetry(page: Page): Promise<TelemetryAttempt[]> {
  const read = await installTelemetryIntercepts(page);
  return read();
}
