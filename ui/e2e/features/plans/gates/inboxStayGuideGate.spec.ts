import { expect, test, type Page, type Route } from '@playwright/test';

import {
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
} from '../../team/shared/propertyTeamRbacHarness';
import { installTierGateMocks } from '../shared/tierGateMocks';

import type { TierCode } from '../../../../src/features/dashboard/plans/lib/planTierExpectations';

const NOW = new Date().toISOString();

/** Web chat thread tied to the test property, so the composer offers Insert. */
const THREAD = {
  id: 'e2e-web-thread',
  organization_id: 'org-team-e2e',
  connection_id: null,
  platform: 'web',
  conversation_type: 'dm',
  external_thread_id: 'web:e2e-guest',
  external_participant_id: 'e2e-guest',
  participant_name: 'Lia Gomez',
  participant_avatar_url: null,
  subject_preview: 'Where do I find the check-in steps?',
  last_message_at: NOW,
  last_inbound_at: NOW,
  unread_count: 0,
  reply_status: 'pending',
  messaging_window_expires_at: null,
  linked_post_id: null,
  linked_post_url: null,
  property_id: TEAM_E2E_PROPERTY_ID,
  property_name: 'Solea Mactan',
  property_slug: TEAM_E2E_PROPERTY_SLUG,
};

function json(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

async function openInsertMenu(page: Page, tier: TierCode) {
  await installTierGateMocks(page, tier);
  await page.route('**/functions/v1/meta-inbox-status*', (route) =>
    json(route, { connections: [], metaConfigured: false })
  );
  await page.route('**/functions/v1/social-inbox-threads*', (route) =>
    json(route, { conversations: [THREAD], nextCursor: null })
  );
  await page.route('**/functions/v1/social-inbox-messages*', (route) =>
    route.request().method() === 'GET'
      ? json(route, { conversation: THREAD, messages: [], hasMore: false })
      : json(route, {})
  );
  await page.route('**/functions/v1/social-inbox-templates*', (route) =>
    json(route, { templates: [] })
  );

  await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox`);
  await page.getByText('Lia Gomez').first().click();
  await page.getByRole('button', { name: 'Insert link or info' }).click();
  return page.getByRole('dialog').getByRole('button', { name: /^Stay guide/i });
}

const composer = (page: Page) => page.getByPlaceholder('Write a reply…');
const upgradeDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: /^Upgrade to / });

/** Inbox Insert → Pages → Stay guide is Pro+ (`propertyShowcase`). */
test.describe('@ci inbox stay guide plan gate', () => {
  test('Free keeps the row visible with a Pro pill and opens the upgrade modal', async ({
    page,
  }) => {
    const row = await openInsertMenu(page, 'free');

    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Pro', { exact: true })).toBeVisible();

    await row.click();
    await expect(upgradeDialog(page)).toBeVisible();
    await expect(upgradeDialog(page)).toContainText('Upgrade to Pro');
    await expect(composer(page)).not.toHaveValue(/stay-guide/);
  });

  test('Pro inserts the stay guide link', async ({ page }) => {
    const row = await openInsertMenu(page, 'growth');

    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Pro', { exact: true })).toHaveCount(0);

    await row.click();
    await expect(composer(page)).toHaveValue(/stay-guide/);
    await expect(upgradeDialog(page)).toHaveCount(0);
  });
});
