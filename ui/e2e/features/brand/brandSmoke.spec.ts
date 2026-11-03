import { expect, test } from '@playwright/test';

/**
 * Brand smoke (rebrand Q-03).
 *
 * Locks the visible product name on the three public entry routes. A stale
 * `VITE_PLATFORM_APP_NAME` or a hardcoded string would fail here, which the
 * source-level `check:brand` guard cannot catch (env is inlined at build time).
 */

const ROUTES = [
  { path: '/', label: 'landing' },
  { path: '/for-hosts', label: 'for hosts' },
  { path: '/sign-in', label: 'sign in' },
];

test.describe('brand smoke @smoke', () => {
  for (const route of ROUTES) {
    test(`${route.label} shows Kame Space and no retired name`, async ({ page }) => {
      await page.goto(route.path);

      await expect(page).toHaveTitle(/Kame Space/);

      const body = page.locator('body');
      await expect(body).not.toContainText('Kame Homes');
      await expect(body).not.toContainText('KameHomes');
    });
  }
});
