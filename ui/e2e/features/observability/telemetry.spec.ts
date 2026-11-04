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

    // `playwright.config.ts` forces VITE_POSTHOG_KEY and VITE_SENTRY_DSN to empty for every
    // run, so this holds on a developer machine too — no skip needed.
    const telemetryLive = await page.evaluate(() => '__SENTRY__' in window);
    expect(telemetryLive, 'E2E must not initialise the Sentry SDK').toBe(false);

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
