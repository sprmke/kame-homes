import { expect, test, type Page, type Route } from '@playwright/test';

import {
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
} from '../team/shared/propertyTeamRbacHarness';
import { installTierGateMocks } from '../plans/shared/tierGateMocks';

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

const TEMPLATES = [
  {
    templateKey: 'house-rules',
    name: 'House Rules',
    category: 'standard',
    description: 'Quiet hours and shared spaces.',
    sectionImageUrl: null,
    folderId: null,
    updatedAt: NOW,
  },
  {
    templateKey: 'custom-welcome',
    name: 'Welcome note',
    category: 'custom',
    description: 'Arrival message with wifi.',
    sectionImageUrl: null,
    folderId: null,
    updatedAt: NOW,
  },
];

const SNAPSHOT = {
  templateKey: 'house-rules',
  name: 'House Rules',
  category: 'standard',
  propertyId: TEAM_E2E_PROPERTY_ID,
  sectionImageUrl: null,
  html: '<h2>House rules</h2><p>Hi Ana, here is a quick reminder.</p><ul><li>Quiet hours start at 10:00 PM.</li><li>No smoking inside the unit.</li></ul>',
};

function json(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

async function openInbox(page: Page) {
  await installTierGateMocks(page, 'growth');
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
  await page.route('**/functions/v1/chat-templates*', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('template_key')) {
      return json(route, { snapshot: SNAPSHOT, plainText: 'House rules' });
    }
    return json(route, { templates: TEMPLATES });
  });

  await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox`);
  await page.getByText('Lia Gomez').first().click();
}

test.describe('@ci inbox chat templates', () => {
  test('sends the selected property template with a preview first', async ({ page }) => {
    const sends: Record<string, unknown>[] = [];
    await openInbox(page);
    await page.route('**/functions/v1/social-inbox-send*', (route) => {
      sends.push(route.request().postDataJSON());
      return json(route, { sent: true });
    });

    await page.getByRole('button', { name: 'Insert link or info' }).click();
    const insertMenu = page.getByRole('dialog').filter({ hasText: 'House Rules' });
    await expect(insertMenu.getByText('Templates', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(insertMenu.getByText('House Rules', { exact: true })).toBeVisible();
    await expect(insertMenu.getByText('Welcome note', { exact: true })).toBeVisible();

    await insertMenu.getByRole('button', { name: /House Rules/ }).click();

    const preview = page.getByRole('dialog').filter({ hasText: 'Quiet hours start at 10:00 PM.' });
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await preview.getByRole('button', { name: 'Send' }).click();

    await expect
      .poll(() => sends.at(-1) ?? null)
      .toMatchObject({
        conversationId: THREAD.id,
        templateKey: 'house-rules',
      });
  });

  test('email templates are never listed', async ({ page }) => {
    await openInbox(page);
    await page.getByRole('button', { name: 'Insert link or info' }).click();
    await expect(page.getByText('House Rules', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('GAF Request', { exact: true })).toHaveCount(0);
  });

  test('phone opens the preview as a sheet with Send reachable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openInbox(page);

    await page.getByRole('button', { name: 'Insert link or info' }).click();
    const insertMenu = page.getByRole('dialog').filter({ hasText: 'House Rules' });
    await expect(insertMenu.getByText('House Rules', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await insertMenu.getByRole('button', { name: /House Rules/ }).click();

    const preview = page.getByRole('dialog').filter({ hasText: 'Quiet hours start at 10:00 PM.' });
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByRole('button', { name: 'Send' })).toBeVisible();
  });
});
