import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
  TEAM_E2E_PROPERTY_SLUG_2,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci inbox thread list smoke', () => {
  test('mock inbox shows seeded conversations', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox?mock=true`);
    await expect(page.getByRole('heading', { name: 'Guest Inbox' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Maria Santos')).toBeVisible({ timeout: 15_000 });
  });

  test('open Facebook thread shows org Meta badge', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox?mock=true`);
    await page.getByText('Maria Santos').click();
    await expect(page.getByText('Org Meta')).toBeVisible({ timeout: 15_000 });
  });

  test('cross-property match suggests switching to the matched property', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      multiProperty: true,
      crossPropertyBookingSeeded: true,
    });
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox?mock=true`);
    await page.getByText('Maria Santos').click();
    const switchLink = page.getByRole('link', { name: /Looks like Solea Cebu/i });
    await expect(switchLink).toBeVisible({ timeout: 15_000 });
    await switchLink.click();
    await expect(page).toHaveURL(new RegExp(`/property/${TEAM_E2E_PROPERTY_SLUG_2}/inbox`));
  });
});
