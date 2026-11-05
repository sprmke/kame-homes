import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks, orgHubPaths } from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci org reviews page', () => {
  test('owner can open the org rollup and filter by property', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(`${orgHubPaths.reviews}?tab=properties`);
    await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Solea Mactan').first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /By property/ })).toBeVisible();
  });
});
