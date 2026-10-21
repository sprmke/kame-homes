import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks, orgHubPaths } from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci org reviews page', () => {
  test('owner can open the org rollup and filter by property', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(orgHubPaths.reviews);
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Great stay.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solea Mactan' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'All properties' }).click();
    await expect(page.getByRole('option', { name: 'Solea Mactan' })).toBeVisible();
  });
});
