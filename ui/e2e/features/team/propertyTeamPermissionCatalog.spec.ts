import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks, teamRbacPaths } from './shared/propertyTeamRbacHarness';

test.describe('@ci property team permission catalog', () => {
  test('Permissions tab lists the AI-spend, assistant, and activity permissions', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.team);
    await page.getByRole('tab', { name: 'Permissions' }).click();

    const main = page.locator('main');
    for (const name of [
      'Generate AI text',
      'Generate AI image',
      'Generate AI video',
      'Manage Smart Pricing',
      'Generate AI review',
      'Use AI Assistant',
      'View Activity',
    ]) {
      await expect(main.getByText(name, { exact: true }), name).toBeVisible();
    }
  });
});
