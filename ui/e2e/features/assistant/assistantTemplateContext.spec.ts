import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  openPropertyDashboard,
} from '../team/shared/propertyTeamRbacHarness';

const TEMPLATES = {
  templates: [
    {
      templateKey: 'house-rules',
      name: 'House Rules',
      category: 'standard',
      content: '<p>Quiet hours start at 10 PM.</p>',
      defaultContent: '<p>Quiet hours start at 10 PM.</p>',
      isDefault: true,
      description: null,
      previewTemplateSlug: null,
      sectionImageUrl: null,
      updatedAt: '2026-10-02T04:00:00.000Z',
      folderId: null,
    },
    {
      templateKey: 'email-gaf-request',
      name: 'GAF Request',
      category: 'email',
      content: '<p>GAF email</p>',
      defaultContent: '<p>GAF email</p>',
      isDefault: true,
      description: null,
      previewTemplateSlug: null,
      sectionImageUrl: null,
      updatedAt: '2026-10-02T04:00:00.000Z',
      folderId: null,
    },
  ],
  folders: [],
  placeholdersReference: [],
};

const SNAPSHOT = {
  templateKey: 'house-rules',
  name: 'House Rules',
  category: 'standard',
  propertyId: 'property-team-e2e-001',
  sectionImageUrl: null,
  html: '<h2>House rules</h2><p>Quiet hours start at 10 PM.</p>',
};

test.describe('@ci assistant template context', () => {
  test('lists property templates and hides email templates', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', { assistantEnabled: true });
    await page.route('**/functions/v1/property-templates-settings**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: TEMPLATES }),
      })
    );
    await page.route('**/functions/v1/chat-templates**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { snapshot: SNAPSHOT, plainText: 'House rules' },
        }),
      })
    );

    await openPropertyDashboard(page);
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Pin context' }).click();
    const templatesRow = page.getByRole('option', { name: /Templates/ });
    await templatesRow.scrollIntoViewIfNeeded();
    await expect(templatesRow).toBeVisible({ timeout: 15_000 });
    await templatesRow.click();

    const items = page.getByRole('option').filter({ hasText: 'House Rules' });
    await expect(items).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('option').filter({ hasText: 'GAF Request' })).toHaveCount(0);

    await items.click();
    await page.getByRole('button', { name: 'Suggested prompts for House Rules' }).click();
    await page.getByRole('button', { name: 'Preview template' }).click();
    await expect(
      page.getByRole('dialog').filter({ hasText: 'Quiet hours start at 10 PM.' })
    ).toBeVisible({ timeout: 15_000 });
  });
});
