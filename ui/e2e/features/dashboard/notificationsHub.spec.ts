import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks } from '../team/shared/propertyTeamRbacHarness';

const HUB = '/org/kame-homes-ph/property/solea-mactan/notifications';

function feedRows(start: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = start + i;
    return {
      id: `n-${n}`,
      type: 'booking_pending_review',
      title: `New booking · Unit ${n}`,
      body: 'Pending review · 2 pax',
      booking_id: `b-${n}`,
      conversation_id: null,
      property_id: 'prop-1',
      parking_id: null,
      metadata: {},
      created_at: new Date(Date.now() - n * 3_600_000).toISOString(),
      isRead: n > 3,
    };
  });
}

/** Paginated feed so the hub's scroll-driven "load more" has something to load. */
async function mockNotificationsList(page: import('@playwright/test').Page) {
  await page.route('**/functions/v1/notifications-list**', async (route) => {
    const params = new URLSearchParams(route.request().url().split('?')[1] ?? '');
    const limit = Number(params.get('limit') ?? 20);
    const cursor = Number(params.get('cursor') ?? 0);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          notifications: feedRows(cursor + 1, limit),
          nextCursor: cursor < 40 ? String(cursor + limit) : null,
          unreadCount: 3,
          unreadSummary: { inbox: 1, bookings: 2, reviews: 0 },
        },
      }),
    });
  });
}

test.describe('@ci notifications hub', () => {
  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
  });

  test('opens on Activity and switches to Telegram via the URL', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.getByRole('tab', { name: /Activity/ })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );

    await page.getByRole('tab', { name: 'Telegram' }).click();
    await expect(page).toHaveURL(/view=telegram/);
    await expect(page.locator('#section-global-bot')).toBeVisible();
    await expect(page.locator('#global-bot-token')).toBeVisible();
  });

  test('a module deep link opens the Telegram view', async ({ page }) => {
    await page.goto(`${HUB}?module=finance`);
    await expect(page.getByRole('tab', { name: 'Telegram' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );
  });

  test('the legacy activity anchor still opens the feed', async ({ page }) => {
    await page.goto(`${HUB}#section-activity`);
    await expect(page.getByRole('tab', { name: /Activity/ })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );
  });

  test('the feed owns one scrollport and pages as it scrolls', async ({ page }) => {
    await mockNotificationsList(page);
    await page.goto(HUB);
    const scroller = page.locator('[data-admin-content-scroll]');
    await expect(scroller).toBeVisible({ timeout: 20_000 });

    const rows = page.locator('[role="tabpanel"] li');
    await expect(rows).toHaveCount(20);

    // The feed must not scroll inside a capped box: one scrollport, not two.
    const nested = await page.evaluate(() =>
      [...document.querySelectorAll('[role="tabpanel"] *')].filter((el) => {
        if (el.hasAttribute('data-admin-content-scroll')) return false;
        const style = getComputedStyle(el);
        const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
        return scrolls && el.scrollHeight > el.clientHeight;
      })
    );
    expect(nested).toHaveLength(0);

    await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(rows).toHaveCount(40);
  });

  test('switching tabs prompts before a dirty bot token is lost', async ({ page }) => {
    await page.goto(`${HUB}?view=telegram`);
    const token = page.locator('#global-bot-token');
    await expect(token).toBeVisible({ timeout: 20_000 });
    await token.fill('123456:TEST-TOKEN');

    await page.getByRole('tab', { name: /Activity/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByRole('tab', { name: 'Telegram' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(token).toHaveValue('123456:TEST-TOKEN');

    await page.getByRole('tab', { name: /Activity/ }).click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('tab', { name: /Activity/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('a clean tab switch does not prompt', async ({ page }) => {
    await page.goto(`${HUB}?view=telegram`);
    await expect(page.locator('#global-bot-token')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /Activity/ }).click();
    await expect(page.getByRole('tab', { name: /Activity/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});
