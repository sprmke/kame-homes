import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Studio Design tab — collage mode. Property gallery photos are not
 * seeded in this mocked harness, so "Fill all" is exercised for wiring only
 * (see the plan doc's manual verification steps for the real-photo path).
 */
test.describe('@ci marketing studio collage', () => {
  test('Start from Collage renders the layout grid and turns the canvas into a collage', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Design' }).click();

    const startFrom = page.getByRole('radiogroup', { name: 'Start from' });
    await expect(startFrom).toBeVisible();
    await expect(startFrom.getByRole('radio', { name: 'Templates' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await startFrom.getByRole('radio', { name: 'Collage' }).click();
    await expect(startFrom.getByRole('radio', { name: 'Collage' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    // Before a layout is chosen, only the Layout picker shows.
    await expect(page.getByText('Pick a layout above to start your collage.')).toBeVisible();
    await expect(page.getByText('Photos', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '2x2 grid' }).click();

    // Choosing a layout turns the canvas into a collage — Photos/Style appear.
    await expect(page.getByText('Photos', { exact: true })).toBeVisible();
    await expect(page.getByText('Style', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '2x2 grid' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // Cell strip renders one thumbnail per layout cell (2x2 = 4).
    await expect(page.getByRole('button', { name: 'Fill all' })).toBeVisible();
  });

  test('Start from Blank clears the canvas and Templates re-applies the last preset', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Design' }).click();
    const startFrom = page.getByRole('radiogroup', { name: 'Start from' });

    await startFrom.getByRole('radio', { name: 'Blank' }).click();
    await expect(page.getByText('Blank canvas at the selected format.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset to blank' })).toBeVisible();

    await startFrom.getByRole('radio', { name: 'Templates' }).click();
    await expect(startFrom.getByRole('radio', { name: 'Templates' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  test.describe('at 390px (bottom sheet)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Collage panel opens in the mobile sheet with no horizontal overflow', async ({
      page,
    }) => {
      await installPropertyTeamRbacMocks(page, 'full_access');
      await page.goto(teamRbacPaths.marketing);
      await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByRole('tab', { name: 'Design' }).click();
      await page.getByRole('toolbar', { name: 'Editor actions' }).getByText('Templates').click();

      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      const startFrom = sheet.getByRole('radiogroup', { name: 'Start from' });
      await startFrom.getByRole('radio', { name: 'Collage' }).click();
      await sheet.getByRole('button', { name: '2x2 grid' }).click();
      await expect(sheet.getByText('Photos', { exact: true })).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  });
});
