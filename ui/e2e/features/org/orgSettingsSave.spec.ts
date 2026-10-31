import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci org settings', () => {
  test('saves org socials with mocked PATCH', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });

    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/settings`);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const patchReady = page.waitForResponse(
      (res) =>
        res.url().includes('/functions/v1/org-settings') &&
        res.request().method() === 'PATCH' &&
        res.ok()
    );

    await page.locator('#section-branding').scrollIntoViewIfNeeded();
    await page.locator('#instagram-url').fill('https://instagram.com/kamehomes');
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();

    await patchReady;
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 10_000 });
  });
});
