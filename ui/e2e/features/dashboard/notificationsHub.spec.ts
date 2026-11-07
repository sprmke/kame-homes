import { expect, test, type Page } from '@playwright/test';

import { installPropertyTeamRbacMocks } from '../team/shared/propertyTeamRbacHarness';

const HUB = '/org/sample-stays-ph/property/solea-mactan/notifications';

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
async function mockNotificationsList(page: Page) {
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

/** The push cards fetch when the Manage sheet opens; keep it hermetic. */
async function mockNotificationPreferences(page: Page) {
  await page.route('**/functions/v1/notification-preferences**', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { preferences: body } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          preferences: {
            mutedGroups: [],
            quietHoursEnabled: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
            quietHoursTimezone: 'Asia/Manila',
          },
        },
      }),
    });
  });
}

/** Two history pages so Newer / Older can be exercised. */
async function mockTelegramHistory(page: Page) {
  await page.route('**/functions/v1/telegram-message-log**', async (route) => {
    const params = new URLSearchParams(route.request().url().split('?')[1] ?? '');
    const cursor = params.get('cursor');
    const firstPage = !cursor;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          messages: [
            {
              id: firstPage ? 'log-1' : 'log-3',
              module: firstPage ? 'chat' : 'finance',
              text: firstPage
                ? 'New message from Ana Reyes on Facebook: Is the unit available on Nov 20?'
                : 'Payment reminder for November dues.',
              status: 'sent',
              error: null,
              createdAt: new Date(Date.now() - (firstPage ? 1 : 30) * 3_600_000).toISOString(),
            },
            {
              id: firstPage ? 'log-2' : 'log-4',
              module: 'marketing',
              text: 'Daily calendar alert: 2 check-ins tomorrow.',
              status: firstPage ? 'failed' : 'sent',
              error: firstPage ? 'Bad Request: chat not found' : null,
              createdAt: new Date(Date.now() - (firstPage ? 2 : 31) * 3_600_000).toISOString(),
            },
          ],
          nextCursor: firstPage ? '2026-11-06T00:00:00.000Z' : null,
          deliveryEnabled: true,
          retentionDays: 15,
        },
      }),
    });
  });
}

async function mockDeliveryControl(page: Page) {
  await page.route('**/functions/v1/telegram-delivery-settings**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = JSON.parse(route.request().postData() ?? '{}') as { enabled?: boolean };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { enabled: body.enabled !== false } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { enabled: true } }),
    });
  });
}

test.describe('@ci notifications hub', () => {
  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await mockNotificationPreferences(page);
    await mockTelegramHistory(page);
    await mockDeliveryControl(page);
  });

  test('opens on Activity with the hub summary cards', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({
      timeout: 20_000,
    });

    /* Draft hub: four KPI cards above the tabs. */
    await expect(page.getByText('Unread', { exact: true })).toBeVisible();
    await expect(page.getByText('Messages', { exact: true })).toBeVisible();
    await expect(page.getByText('Telegram on', { exact: true })).toBeVisible();
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();

    await expect(page.getByRole('tab', { name: /Activity/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('heading', { name: 'Activity', level: 2 })).toBeVisible();
  });

  test('the Telegram tab shows what the groups received', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.getByRole('tab', { name: 'Telegram' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'Telegram' }).click();

    await expect(page).toHaveURL(/[?&]view=telegram/);
    await expect(page.getByText('New message from Ana Reyes on Facebook')).toBeVisible();
    /* A rejected send is kept, with Telegram's reason. */
    await expect(page.getByText('Failed', { exact: true })).toBeVisible();
    await expect(page.getByText('Bad Request: chat not found')).toBeVisible();

    /* Older walks to the second page, Newer comes back. */
    await page.getByRole('button', { name: 'Older' }).click();
    await expect(page.getByText('Payment reminder for November dues.')).toBeVisible();
    await page.getByRole('button', { name: 'Newer' }).click();
    await expect(page.getByText('New message from Ana Reyes on Facebook')).toBeVisible();
  });

  test('a module deep link opens the Telegram management tab', async ({ page }) => {
    await page.goto(`${HUB}?module=finance`);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('tab', { name: 'Telegram' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.locator('#section-finance')).toBeVisible();
    await expect(page.locator('#section-finance')).toContainText('Due-date reminders');
  });

  test('a bare Telegram deep link opens the history tab', async ({ page }) => {
    await page.goto(`${HUB}?view=telegram`);
    await expect(page.getByRole('tab', { name: 'Telegram' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );
    await expect(page.getByText('New message from Ana Reyes on Facebook')).toBeVisible();
  });

  test('the legacy activity anchor still opens the feed', async ({ page }) => {
    await page.goto(`${HUB}#section-activity`);
    await expect(page.getByRole('tab', { name: /Activity/ })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );
    await expect(page.getByRole('heading', { name: 'Activity', level: 2 })).toBeVisible();
  });

  test('the feed owns one scrollport and pages as it scrolls', async ({ page }) => {
    await mockNotificationsList(page);
    await page.goto(HUB);
    const scroller = page.locator('[data-admin-content-scroll]').first();
    await expect(scroller).toBeVisible({ timeout: 20_000 });

    const rows = page.locator('[data-admin-content-scroll] ul[aria-label="Notifications"] > li');
    await expect(rows).toHaveCount(20);

    // The feed must not scroll inside a capped box: one scrollport, not two.
    const nested = await page.evaluate(() =>
      [...document.querySelectorAll('[data-admin-content-scroll] *')].filter((el) => {
        const style = getComputedStyle(el);
        const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
        return scrolls && el.scrollHeight > el.clientHeight;
      })
    );
    expect(nested).toHaveLength(0);

    // Scroll the feed to its load-more sentinel, the way a reader reaches it.
    await page.locator('[data-admin-content-scroll] [role="status"]').scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(40, { timeout: 15_000 });
  });

  test('the Manage sheet holds delivery settings and the Telegram controls', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({
      timeout: 20_000,
    });

    /* The list is the first thing on the tab; settings live behind Manage. */
    await page.getByRole('button', { name: 'Manage', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    /*
     * Headless Chromium cannot subscribe here, so the switch must be disabled and
     * the row must explain why instead of inviting a click that would fail.
     */
    const deviceSwitch = dialog.getByRole('switch', { name: 'Push notifications' });
    await expect(deviceSwitch).toBeVisible();
    await expect(deviceSwitch).toBeDisabled();
    await expect(
      dialog.getByText(/Preparing push|aren't available|doesn't support/i)
    ).toBeVisible();

    /* How it works now lives beside the page title. */
    await dialog.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'How notifications work' }).click();
    const help = page.getByRole('dialog').last();
    await expect(help.getByRole('heading', { name: 'How notifications work' })).toBeVisible();
    await expect(help.getByText('In-app', { exact: true })).toBeVisible();
    await expect(help.getByText('Phone push', { exact: true })).toBeVisible();
    await expect(help.getByText('Pick per channel', { exact: true })).toBeVisible();
    await help.getByRole('button', { name: 'Close' }).first().click();

    /* Reopen Manage for the Telegram tab. */
    await page.getByRole('button', { name: 'Manage', exact: true }).click();
    const manage = page.getByRole('dialog');
    await manage.getByRole('tab', { name: 'Telegram' }).click();
    await expect(manage.getByText('Telegram delivery')).toBeVisible();
    await expect(manage.getByRole('switch', { name: 'Telegram delivery' })).toBeChecked();
    await expect(page.locator('#section-chat')).toBeVisible({ timeout: 20_000 });
  });

  test('the Telegram history tab keeps the delivery switch and drops the paused card', async ({
    page,
  }) => {
    await page.route('**/functions/v1/telegram-delivery-settings**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { enabled: false } }),
      })
    );

    await page.goto(`${HUB}?view=telegram`);
    await expect(page.getByRole('tab', { name: 'Telegram' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );

    /* One master switch on the tab; no second "paused" card repeating it. */
    await expect(page.getByRole('switch', { name: 'Telegram delivery' })).not.toBeChecked();
    await expect(page.getByText('Telegram is paused')).toHaveCount(0);
    /* Past sends stay readable while delivery is paused. */
    await expect(page.getByText('New message from Ana Reyes on Facebook')).toBeVisible();
  });

  test('the master switch turns delivery off', async ({ page }) => {
    await page.goto(HUB);
    await page.getByRole('button', { name: 'Manage', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Telegram' }).click();

    const master = dialog.getByRole('switch', { name: 'Telegram delivery' });
    await expect(master).toBeChecked();
    await master.click();

    await expect(dialog.getByText('Telegram is paused')).toBeVisible();
    /* Module controls are hidden while delivery is off. */
    await expect(page.locator('#section-chat')).toHaveCount(0);
    await expect(master).not.toBeChecked();
  });

  test('Telegram paused hides the module controls', async ({ page }) => {
    await page.route('**/functions/v1/telegram-delivery-settings**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { enabled: false } }),
      })
    );

    await page.goto(HUB);
    await page.getByRole('button', { name: 'Manage', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Telegram' }).click();

    await expect(dialog.getByText('Telegram is paused')).toBeVisible();
    await expect(dialog.getByRole('switch', { name: 'Telegram delivery' })).not.toBeChecked();
    /* No module configuration while delivery is off. */
    await expect(page.locator('#section-chat')).toHaveCount(0);
  });

  test('closing a dirty bot token prompts before it is lost', async ({ page }) => {
    await page.goto(`${HUB}?module=chat`);
    const token = page.locator('#global-bot-token');
    await expect(token).toBeVisible({ timeout: 20_000 });
    await token.fill('123456:TEST-TOKEN');

    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.locator('#global-bot-token')).toHaveValue('123456:TEST-TOKEN');

    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('switching Manage tabs with a clean token does not prompt', async ({ page }) => {
    await page.goto(`${HUB}?module=chat`);
    const dialog = page.getByRole('dialog');
    await expect(page.locator('#global-bot-token')).toBeVisible({ timeout: 20_000 });

    await dialog.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(
      dialog.getByRole('switch', { name: 'Push notifications' })
    ).toBeVisible();
  });
});
