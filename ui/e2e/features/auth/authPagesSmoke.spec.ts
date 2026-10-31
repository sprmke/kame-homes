import { expect, test } from '@playwright/test';

test.describe('@smoke @ci auth pages', () => {
  test('for-hosts login page renders', async ({ page }) => {
    await page.goto('/for-hosts/login');
    await expect(page.getByRole('button', { name: /Continue with Google|Sign in/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('for-guests login page renders', async ({ page }) => {
    await page.goto('/for-guests/login');
    await expect(page.getByRole('button', { name: /Continue with Google|Sign in/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
