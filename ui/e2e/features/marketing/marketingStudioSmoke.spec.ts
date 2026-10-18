import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci marketing studio smoke', () => {
  test('marketing studio tabs load for Full Access', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.marketingWorkspace);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Posts' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Videos' })).toBeVisible();
  });
});
