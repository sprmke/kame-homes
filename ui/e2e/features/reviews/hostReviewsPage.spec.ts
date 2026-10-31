import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci host reviews page', () => {
  test('Full Access can open received reviews and respond', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.reviews);
    await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Great stay.')).toBeVisible();
    await page.getByRole('button', { name: 'Respond', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Respond/ })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByLabel('Public response').fill('Thanks for staying with us.');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Response saved')).toBeVisible({ timeout: 10_000 });
  });

  test('To write opens the host guest review sheet', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`${teamRbacPaths.reviews}?tab=to_write`);
    await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Write review for Maria Santos' }).first().click();
    await expect(page.getByRole('heading', { name: /Review Maria Santos/ })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Read Only hides respond and offers the booking link instead', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'read_only');
    await page.goto(teamRbacPaths.reviews);
    await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Respond', exact: true })).toHaveCount(0);
    await page.goto(`${teamRbacPaths.reviews}?tab=to_write`);
    await expect(page.getByRole('button', { name: /^Write review for/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open booking for Maria Santos' })).toBeVisible();
  });
});
