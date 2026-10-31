import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  orgHubPaths,
  TEAM_E2E_ORG_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

const SETTINGS_URL = new RegExp(`/org/${TEAM_E2E_ORG_SLUG}/settings$`);

/** Dashboard -> Settings via a client-side link so `history` entries stay in one document. */
async function openSettingsAndEdit(page: Page) {
  await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
  await page.goto(orgHubPaths.dashboard);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator(`a[href="/org/${TEAM_E2E_ORG_SLUG}/settings"]:visible`).first().click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('#section-branding').scrollIntoViewIfNeeded();
  await page.locator('#instagram-url').fill('https://instagram.com/kamehomes');
}

test.describe('@ci unsaved changes guard', () => {
  test('clean form navigates back without a prompt', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(orgHubPaths.dashboard);
    await page.locator(`a[href="/org/${TEAM_E2E_ORG_SLUG}/settings"]:visible`).first().click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.goBack();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(SETTINGS_URL);
  });

  test('back prompts; Keep editing stays, Discard leaves', async ({ page }) => {
    await openSettingsAndEdit(page);

    await page.goBack();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Save your changes?')).toBeVisible();

    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#instagram-url')).toHaveValue('https://instagram.com/kamehomes');
    await expect(page).toHaveURL(SETTINGS_URL);

    await page.goBack();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await expect(page).not.toHaveURL(SETTINGS_URL);
  });

  test('clicking another menu prompts', async ({ page }) => {
    await openSettingsAndEdit(page);
    await page.locator(`a[href="/org/${TEAM_E2E_ORG_SLUG}/bookings"]:visible`).first().click();
    await expect(page.getByRole('alertdialog').getByText('Save your changes?')).toBeVisible();
    await expect(page).toHaveURL(SETTINGS_URL);
  });

  test('Save & leave persists then navigates', async ({ page }) => {
    await openSettingsAndEdit(page);

    const patchReady = page.waitForResponse(
      (res) =>
        res.url().includes('/functions/v1/org-settings') &&
        res.request().method() === 'PATCH' &&
        res.ok()
    );
    await page.goBack();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Save & leave' }).click();
    await patchReady;
    await expect(page).not.toHaveURL(SETTINGS_URL);
  });

  test('saving normally does not prompt afterwards', async ({ page }) => {
    await openSettingsAndEdit(page);
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 10_000 });
    await page.goBack();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(SETTINGS_URL);
  });

  test('tab close / refresh with unsaved edits is flagged via beforeunload', async ({ page }) => {
    const beforeUnloadPrevented = () =>
      page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });

    await openSettingsAndEdit(page);
    expect(await beforeUnloadPrevented()).toBe(true);

    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 10_000 });
    expect(await beforeUnloadPrevented()).toBe(false);
  });
});
