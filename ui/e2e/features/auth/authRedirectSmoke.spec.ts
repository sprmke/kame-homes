import { expect, test } from '@playwright/test';

test.describe('@smoke @ci auth redirect', () => {
  test('unauthenticated host is redirected to login from org dashboard', async ({ page }) => {
    await page.goto('/org/kame-homes-ph/property/solea-mactan/bookings');
    await expect(page).toHaveURL(/\/for-hosts\/login/, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Continue with Google|Sign in/i })).toBeVisible();
  });
});
