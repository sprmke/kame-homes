import { expect, test } from '@playwright/test';

test.describe('@smoke @ci auth legacy redirects', () => {
  test('/sign-in redirects to for-hosts login', async ({ page }) => {
    await page.goto('/sign-in?redirect=%2Forg%2Fkame-homes-ph%2Fdashboard');
    await expect(page).toHaveURL(/\/for-hosts\/login/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Continue with Google|Sign in/i })).toBeVisible();
  });
});
