import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Studio Design tab — the 2026-10-30 entry: Posts → New post opens a sheet with
 * Size / Blank / Collage / starter looks. Collage then opens the layout editor.
 */
async function openNewPost(page: import('@playwright/test').Page, kind: 'Collage' | 'Blank') {
  await installPropertyTeamRbacMocks(page, 'full_access');
  await page.goto(teamRbacPaths.marketingWorkspace);
  await page.getByRole('tab', { name: 'Posts' }).click();
  await expect(page.getByRole('tab', { name: 'Posts' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'New post', exact: true }).click();
  await page.getByRole('button', { name: kind, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`from=${kind.toLowerCase()}`));
}

test.describe('@ci marketing studio collage', () => {
  test('a collage starts from a layout and fills the canvas', async ({ page }) => {
    await openNewPost(page, 'Collage');

    await expect(page.getByText('Pick a layout above to start your collage.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: '2x2 grid' })).toBeVisible();

    await page.getByRole('button', { name: '2x2 grid' }).click();
    await expect(page.getByText('Pick a layout above to start your collage.')).toBeHidden({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Fill all' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: '2x2 grid' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('a blank post opens the editor and can switch into collage', async ({ page }) => {
    await openNewPost(page, 'Blank');
    await expect(page.getByRole('button', { name: 'Back to Posts' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
    // A blank post opens an empty canvas named "Untitled", not a preset design.
    await expect(page.getByRole('button', { name: /Untitled post/ })).toBeVisible();
    await expect(page.getByText('Pick a layout above to start your collage.')).toHaveCount(0);
  });

  test.describe('at 390px (bottom sheet)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the new-post sheet opens collage without sideways scroll', async ({ page }) => {
      await installPropertyTeamRbacMocks(page, 'full_access');
      await page.goto(teamRbacPaths.marketingWorkspace);
      await page.getByRole('tab', { name: 'Posts' }).click();
      await page.getByRole('button', { name: 'New post', exact: true }).click();
      await page.getByRole('button', { name: 'Collage', exact: true }).click();

      const sheet = page.getByRole('dialog');
      if (await sheet.count()) {
        await expect(sheet.getByRole('button', { name: '2x2 grid' })).toBeVisible({
          timeout: 20_000,
        });
        await sheet.getByRole('button', { name: '2x2 grid' }).click();
        await expect(sheet.getByText('Pick a layout above to start your collage.')).toBeHidden({
          timeout: 30_000,
        });
      } else {
        await expect(page.getByRole('button', { name: '2x2 grid' })).toBeVisible({
          timeout: 20_000,
        });
      }

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  });
});
