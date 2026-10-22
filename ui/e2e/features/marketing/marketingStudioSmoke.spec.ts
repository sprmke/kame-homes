import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci marketing studio smoke', () => {
  test('tabs load in order and AI Studio opens first', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.marketingWorkspace);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });
    const tabs = page.getByRole('tab', { name: /^(AI Studio|Posts|Videos|Calendar)/ });
    await expect(tabs).toHaveText([/AI Studio/, 'Posts', 'Videos', 'Calendar']);
    await expect(page.getByRole('tab', { name: /AI Studio/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // Nothing made yet: AI Studio opens on the chooser.
    await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
  });
});
