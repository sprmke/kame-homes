import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks } from '../team/shared/propertyTeamRbacHarness';

const TEMPLATES_PATH = '/org/kame-homes-ph/property/solea-mactan/templates';

const tpl = (
  templateKey: string,
  name: string,
  category: 'standard' | 'email' | 'custom',
  folderId: string | null = null
) => ({
  templateKey,
  name,
  category,
  content: `<p>Default ${name} content</p>`,
  defaultContent: `<p>Default ${name} content</p>`,
  isDefault: true,
  description: null,
  previewTemplateSlug: null,
  sectionImageUrl: null,
  updatedAt: '2026-10-02T04:00:00.000Z',
  folderId,
});

/** A library with both built-in sections, two filled folders and one empty one. */
const payload = {
  templates: [
    tpl('house-rules', 'House Rules', 'standard'),
    tpl('check-in-instructions', 'Check-in Instructions', 'standard'),
    tpl('email-gaf-request', 'GAF Request', 'email'),
    tpl('custom-a', 'Welcome Note', 'custom', 'f1'),
    tpl('custom-b', 'Wifi and codes', 'custom', 'f1'),
    tpl('custom-c', 'Late checkout offer', 'custom', 'f2'),
    tpl('custom-d', 'Typhoon advisory', 'custom', null),
  ],
  folders: [
    { id: 'f1', name: 'Arrival pack', position: 0, templateCount: 2 },
    { id: 'f2', name: 'Upsells', position: 1, templateCount: 1 },
    { id: 'f3', name: 'Archive', position: 2, templateCount: 0 },
  ],
  placeholdersReference: ['{{guestName}}'],
};

/** Captures every organise PATCH so the tests can assert the endpoint contract. */
async function installTemplatesMocks(page: import('@playwright/test').Page) {
  const bodies: Record<string, unknown>[] = [];
  await installPropertyTeamRbacMocks(page, 'full_access', { customTemplateSeeded: true });
  await page.route('**/functions/v1/property-templates-settings**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    if (request.method() === 'PATCH') bodies.push(request.postDataJSON());
    await route.fulfill({ json: { success: true, data: payload } });
  });
  return bodies;
}

test.describe('@ci property templates workbench', () => {
  test('groups built-ins, folders and ungrouped custom templates', async ({ page }) => {
    await installTemplatesMocks(page);
    await page.goto(TEMPLATES_PATH);

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await expect(rail).toBeVisible({ timeout: 20_000 });
    for (const label of ['Emails', 'Stay guide', 'Arrival pack', 'Upsells', 'Archive', 'Custom']) {
      await expect(rail.getByText(label, { exact: true })).toBeVisible();
    }
    // An empty folder still shows, so a template can be moved into it.
    await expect(rail.getByRole('status', { name: 'Archive has no templates' })).toBeVisible();
    await expect(rail.getByRole('button', { name: 'Add template' })).toBeVisible();

    // Desktop lands on a template instead of an empty pane.
    await expect(
      page.getByRole('region', { name: 'Template editor' }).getByRole('heading', {
        name: 'House Rules',
      })
    ).toBeVisible();
  });

  test('organise actions post the expected payloads', async ({ page }) => {
    const bodies = await installTemplatesMocks(page);
    await page.goto(TEMPLATES_PATH);

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await expect(rail).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'New group' }).click();
    await page.getByLabel('Group name').fill('Checkout');
    await page.getByRole('button', { name: 'Create group' }).click();

    await rail.getByRole('button', { name: 'Actions for Welcome Note' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.getByLabel('Template name').fill('Welcome note v2');
    await page.getByRole('button', { name: 'Save name' }).click();

    await rail.getByRole('button', { name: 'Actions for Welcome Note' }).click();
    await page.getByRole('menuitem', { name: 'Move' }).click();
    await page.getByRole('button', { name: 'Upsells' }).click();

    await rail.getByRole('button', { name: 'Actions for Archive' }).click();
    await page.getByRole('menuitem', { name: 'Rename folder' }).click();
    await page.getByLabel('Folder name').fill('Old stuff');
    await page.getByRole('button', { name: 'Save name' }).click();

    await expect.poll(() => bodies.length).toBe(4);
    expect(bodies).toEqual([
      { action: 'createFolder', name: 'Checkout' },
      { action: 'rename', templateKey: 'custom-a', name: 'Welcome note v2' },
      { action: 'move', templateKey: 'custom-a', category: 'custom', folderId: 'f2' },
      { action: 'renameFolder', folderId: 'f3', name: 'Old stuff' },
    ]);
  });
});

test.describe('@smoke property templates on phone', () => {
  test('list first, then one editor at a time', async ({ page }) => {
    await installTemplatesMocks(page);
    await page.goto(TEMPLATES_PATH);

    const rail = page.getByRole('complementary', { name: 'Templates' });
    await expect(rail).toBeVisible({ timeout: 20_000 });

    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 1024, 'Phone and tablet layout only');

    // The list is the landing view: no editor is mounted behind it.
    await expect(page.getByRole('region', { name: 'Template editor' })).toHaveCount(0);

    await rail.getByRole('button', { name: /^Welcome Note/ }).click();
    const pane = page.getByRole('region', { name: 'Template editor' });
    await expect(pane.getByRole('heading', { name: 'Welcome Note' })).toBeVisible();
    await expect(rail).toHaveCount(0);

    await pane.getByRole('button', { name: 'All templates' }).click();
    await expect(page.getByRole('complementary', { name: 'Templates' })).toBeVisible();
  });
});
