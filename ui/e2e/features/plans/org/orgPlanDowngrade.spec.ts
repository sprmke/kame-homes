import { expect, test } from '@playwright/test';

import {
  installPlansDowngradeMocks,
  openDowngradeReview,
  openOrgPlansPage,
} from '../shared/orgPlanDowngradeHarness';

test.describe('@ci org plan downgrade flow', () => {
  test('paid→paid shows Confirm downgrade and applies without PayMongo', async ({ page }) => {
    const state = await installPlansDowngradeMocks(page);
    await openOrgPlansPage(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openDowngradeReview(page, 'Starter');

    await expect(page.getByRole('button', { name: 'Confirm downgrade' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0);
    await expect(page.getByText(/not refunded/i)).toBeVisible();

    await page.getByRole('button', { name: 'Confirm downgrade' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.downgradeCalls).toEqual(['plan-starter']);
  });

  test('paid→Free requires acknowledgment before confirm', async ({ page }) => {
    await installPlansDowngradeMocks(page);
    await openOrgPlansPage(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openDowngradeReview(page, 'Free');

    const confirm = page.getByRole('button', { name: 'Confirm downgrade' });
    await expect(confirm).toBeDisabled();
    await expect(page.getByRole('checkbox')).toBeVisible();

    await page.getByRole('checkbox').check();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('past_due blocks downgrade confirm', async ({ page }) => {
    await installPlansDowngradeMocks(page, { subscriptionStatus: 'past_due' });
    await openOrgPlansPage(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openDowngradeReview(page, 'Starter');

    await expect(page.getByText(/overdue balance/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm downgrade' })).toBeDisabled();
  });

  test('suspended blocks paid→paid but allows Free with acknowledgment', async ({ page }) => {
    await installPlansDowngradeMocks(page, { subscriptionStatus: 'suspended' });
    await openOrgPlansPage(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openDowngradeReview(page, 'Starter');

    await expect(page.getByText(/restore access/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm downgrade' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('tab', { name: 'Plans' }).click();
    await openDowngradeReview(page, 'Free');
    const confirm = page.getByRole('button', { name: 'Confirm downgrade' });
    await expect(confirm).toBeDisabled();
    await page.getByRole('checkbox').check();
    await expect(confirm).toBeEnabled();
  });

  test('non-owner cannot start downgrade from tier rail', async ({ page }) => {
    await installPlansDowngradeMocks(page, { accessKind: 'member' });
    await openOrgPlansPage(page);
    await page.getByRole('tab', { name: 'Plans' }).click();

    await expect(page.getByRole('button', { name: /Downgrade to Starter/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Upgrade to Business/i })).toHaveCount(0);
  });
});
