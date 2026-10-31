import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_PROPERTY_NAME_2,
  TEAM_E2E_ORG_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci org properties — copy settings', () => {
  test('copy settings wizard shows dry-run preview', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      multiProperty: true,
      orgHub: true,
    });

    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/properties`);
    await expect(page.getByRole('heading', { name: 'Properties', exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Copy settings' }).click();
    await expect(page.getByRole('heading', { name: 'Source' })).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Targets' })).toBeVisible();

    await page.getByRole('checkbox', { name: new RegExp(TEAM_E2E_PROPERTY_NAME_2) }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('will copy', { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Copy settings' })).toBeEnabled();
  });
});
