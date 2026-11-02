import { expect, test } from '@playwright/test';

import { installTelemetryIntercepts } from '../../shared/interceptTelemetry';

/**
 * Proves a browser run sends nothing to PostHog or Sentry.
 *
 * The static guards already prove the code cannot *call* PostHog's exception API. This
 * covers the other half: that a real page load does not ship events either, so CI cannot
 * quietly fill the two datasets with synthetic traffic.
 *
 * Deliberately does not assert which events *should* fire — that is a per-feature concern,
 * and pinning it here would make every product change edit this spec.
 */
test.describe('@ci observability', () => {
  test('a public page load sends no telemetry', async ({ page }) => {
    const attempts = await installTelemetryIntercepts(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find your next stay/i })).toBeVisible({
      timeout: 20_000,
    });

    // A developer with a real DSN in `ui/.env.development.local` legitimately sends events,
    // and the intercepts swallow them. CI is the environment where telemetry must be silent,
    // so this asserts there and skips locally rather than failing a working setup.
    const telemetryLive = await page.evaluate(() => '__SENTRY__' in window);
    test.skip(telemetryLive, 'local env has a DSN; this assertion is for CI (empty DSNs)');

    // Give a fire-and-forget capture a moment to try. Nothing should appear, because the
    // intercepts abort every pattern the SDKs use.
    await page.waitForTimeout(500);

    expect(attempts(), 'telemetry must not leave a browser test').toEqual([]);
  });

  test('the intercepts really catch a telemetry call', async ({ page }) => {
    const attempts = await installTelemetryIntercepts(page);
    await page.goto('/');

    // Positive control: if the patterns stopped matching, the test above would pass
    // vacuously. This proves the net is real before trusting a zero result.
    await page.evaluate(async () => {
      await fetch('/ingest/e/?ip=1', { method: 'POST', body: '{}' }).catch(() => {});
    });
    await page.waitForTimeout(300);

    expect(attempts().length).toBeGreaterThan(0);
    expect(attempts()[0]?.kind).toBe('posthog');
  });
});
