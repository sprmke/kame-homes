import { expect, test } from '@playwright/test';

import { installGuestFavoritesMocks } from './shared/guestFavoritesHarness';

test.describe('@ci guest account reviews', () => {
  test('to write lists a stay and opens write review', async ({ page }) => {
    await installGuestFavoritesMocks(page);
    await page.goto('/account/reviews');
    await expect(
      page.getByRole('tab', { name: 'To write' }).or(page.getByText('To write'))
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Solea Mactan')).toBeVisible();
    const writeLink = page.getByRole('link', { name: 'Write review' });
    await expect(writeLink).toHaveAttribute('href', /\/properties\/solea-mactan\/guest-review/);
    // The booking access token rides in sessionStorage, never the URL.
    await expect(writeLink).not.toHaveAttribute('href', /access=/);
    await expect
      .poll(() =>
        page.evaluate(() => sessionStorage.getItem('guest-booking-access:booking-review-1'))
      )
      .toBe('v1.booking-review-1.9999999999999.e2e-signature');
  });
});
