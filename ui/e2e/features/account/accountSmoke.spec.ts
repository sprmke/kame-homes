import { expect, test } from '@playwright/test';

import { installGuestFavoritesMocks } from './shared/guestFavoritesHarness';

test.describe('@ci guest account shells', () => {
  test('profile page loads with mocked guest-profile', async ({ page }) => {
    await installGuestFavoritesMocks(page);
    await page.goto('/account/profile');
    await expect(page.getByLabel('Display name')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('stays page shows empty messages state', async ({ page }) => {
    await installGuestFavoritesMocks(page);
    await page.goto('/account/stays');
    await expect(page.getByText('No messages yet.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Browse properties' })).toHaveAttribute(
      'href',
      '/properties'
    );
  });
});
