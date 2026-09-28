import { expect, test } from '@playwright/test';

import { installConsoleMocks } from './shared/adminAiConsoleHarness';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

test.describe('@ci super admin AI console', () => {
  test('@smoke limits tab lists organizations with flags and no layout overflow', async ({
    page,
  }) => {
    await installConsoleMocks(page);
    await page.goto('/admin/ai?tab=limits');
    await expect(page.getByRole('heading', { name: 'AI', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Alpha Stays').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Beta Homes').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Override').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('At limit').filter({ visible: true }).first()).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });

  test('bulk assign sends one write for every selected organization', async ({ page }) => {
    const posts = await installConsoleMocks(page);
    await page.goto('/admin/ai?tab=limits');
    await page.getByLabel('Select Alpha Stays').filter({ visible: true }).first().click();
    await page.getByLabel('Select Beta Homes').filter({ visible: true }).first().click();
    await expect(page.getByText('2 selected')).toBeVisible();
    await page.getByRole('button', { name: 'Assign profile' }).first().click();
    await page.getByRole('combobox', { name: 'Profile' }).click();
    await page.getByRole('option', { name: 'Growth' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      action: 'assign',
      scope: 'organization',
      profileId: 'p-growth',
    });
    expect(posts[0].scopeIds).toEqual(['org-1', 'org-2']);
  });

  test('profiles tab shows profiles, plans and developments', async ({ page }) => {
    await installConsoleMocks(page);
    await page.goto('/admin/ai?tab=profiles');
    await expect(page.getByText('Platform default').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Growth').first()).toBeVisible();
    await expect(page.getByText('Azure North')).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test('usage tab shows assistant evals per module, weakest first', async ({ page }) => {
    await installConsoleMocks(page);
    await page.goto('/admin/ai?tab=usage');
    const evals = page.getByRole('region', { name: 'Assistant evals' });
    await expect(evals).toBeVisible({ timeout: 20_000 });
    await expect(evals.getByText('25/26 passed · routed · 21.1 tools per turn')).toBeVisible();
    await expect(evals.getByText('Failed: maintenance-create')).toBeVisible();
    await expect(evals.getByText('100% (26/26)')).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test('legacy AI URLs redirect into the console', async ({ page }) => {
    await installConsoleMocks(page);
    await page.goto('/admin/ai-usage');
    await expect(page).toHaveURL(/\/admin\/ai\?tab=usage/);
    await page.goto('/admin/settings');
    await expect(page).toHaveURL(/\/admin\/ai\?tab=controls/);
  });
});
