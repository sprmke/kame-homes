import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
  TEAM_E2E_ORG_SLUG,
} from './shared/propertyTeamRbacHarness';

const BOOKINGS_LINK = `a[href="/org/${TEAM_E2E_ORG_SLUG}/property/solea-mactan/bookings"]:visible`;

async function openCleanPropertySettings(page: import('@playwright/test').Page) {
  await installPropertyTeamRbacMocks(page, 'full_access');
  await page.goto(teamRbacPaths.settings);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('#property-name')).toBeVisible({ timeout: 20_000 });
  // The mock starts with max children 0; unit-type defaults sync it to 2 on load.
  // Waiting for that value proves the load-time normalization ran before we leave.
  await expect(page.locator('#property-max-children')).toHaveValue('2', { timeout: 20_000 });
}

test.describe('@ci property settings clean navigation', () => {
  test('load-time sync does not enable Save or prompt on leave', async ({ page }) => {
    await openCleanPropertySettings(page);

    await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);

    await page.locator(BOOKINGS_LINK).first().click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp('property/solea-mactan/bookings'));
  });

  test('a real host edit still prompts and Keep editing stays', async ({ page }) => {
    await openCleanPropertySettings(page);

    await page.locator('#property-name').fill('Solea Mactan Updated');
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();

    await page.locator(BOOKINGS_LINK).first().click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Save your changes?')).toBeVisible();

    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp('property/solea-mactan/settings$'));
  });
});
