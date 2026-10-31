import { expect, test } from '@playwright/test';

import { installGuestFavoritesMocks } from './shared/guestFavoritesHarness';

const ACCESS_TOKEN = 'v1.booking-review-1.9999999999999.e2e-signature';

test.describe('@ci guest account reviews', () => {
  test('to write lists a stay and opens write review', async ({ page }) => {
    await installGuestFavoritesMocks(page);
    await page.route('**/functions/v1/list-my-reviews**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tab: 'to_write',
            reputation: null,
            items: [
              {
                bookingId: 'booking-review-1',
                propertyName: 'Solea Mactan',
                propertySlug: 'solea-mactan',
                propertyImageUrl: null,
                checkInDate: '2026-10-01',
                checkOutDate: '2026-10-03',
                closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
                accessToken: ACCESS_TOKEN,
              },
            ],
            nextCursor: null,
          },
        }),
      })
    );

    await page.goto('/account/reviews');
    await expect(
      page.getByRole('tab', { name: 'To write' }).or(page.getByText('To write'))
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Solea Mactan')).toBeVisible();
    const writeLink = page.getByRole('link', { name: 'Write review' });
    await expect(writeLink).toHaveAttribute('href', /\/properties\/solea-mactan\/guest-review/);
    // The booking access token rides in sessionStorage, never in the URL.
    await expect(writeLink).not.toHaveAttribute('href', /access=/);
    await expect
      .poll(() =>
        page.evaluate(() => sessionStorage.getItem('guest-booking-access:booking-review-1'))
      )
      .toBe(ACCESS_TOKEN);
  });
});
