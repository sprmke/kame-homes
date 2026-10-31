import { expect, test } from '@playwright/test';

import { installGuestFavoritesMocks } from './shared/guestFavoritesHarness';

test.describe('@ci guest account — favorites', () => {
  test('favorites page lists saved property from mock API', async ({ page }) => {
    await installGuestFavoritesMocks(page);

    await page.goto('/account/favorites');
    await expect(page.getByText('Solea Mactan')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('₱3,500')).toBeVisible();
  });

  test('empty favorites shows browse CTA', async ({ page }) => {
    await installGuestFavoritesMocks(page, []);

    await page.goto('/account/favorites');
    await expect(page.getByText('No saved properties.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Browse properties' })).toHaveAttribute(
      'href',
      '/properties'
    );
  });
});
