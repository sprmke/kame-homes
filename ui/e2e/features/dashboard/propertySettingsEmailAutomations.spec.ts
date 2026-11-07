import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Settings cleanup: Email automations is inline, without the retired Parking owners
 * field, and Cleaning Time now lives under Property Details.
 */
async function openPropertySettings(page: import('@playwright/test').Page) {
  await page.goto(teamRbacPaths.settings);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('@ci property settings cleanup', () => {
  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
  });

  test('Email automations drops Parking owners and shows the building admin email', async ({
    page,
  }) => {
    await openPropertySettings(page);

    const section = page.locator('#section-email-automations');
    await expect(section).toBeVisible({ timeout: 20_000 });
    await expect(section.getByText('Email automations')).toBeVisible();
    await expect(section.getByText('Building admin email')).toBeVisible();
    await expect(section.getByText('Parking owners')).toHaveCount(0);
    await expect(section.locator('#parking-owner-emails')).toHaveCount(0);
  });

  test('Automated sends is a summary row that opens the toggles in a Manage modal', async ({
    page,
  }) => {
    await openPropertySettings(page);

    const section = page.locator('#section-email-automations');
    await expect(section.getByRole('heading', { name: 'Automated sends' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(section.getByText(/\d+ of \d+ on/)).toBeVisible();
    await expect(section.getByRole('switch', { name: 'New booking alert' })).toHaveCount(0);

    await section.getByRole('button', { name: 'Manage' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Your team', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Building admin', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Guest reviews', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('switch', { name: 'New booking alert' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('Cleaning Time lives under Property Details, not Guest Form', async ({ page }) => {
    await openPropertySettings(page);

    const details = page.locator('#section-details');
    await expect(details.getByText('Cleaning Time')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#property-cleaning-buffer')).toHaveCount(1);
    await expect(page.locator('#guest-form-cleaning-buffer')).toHaveCount(0);
  });
});
