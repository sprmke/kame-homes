import { expect, test } from '@playwright/test';

import { installOnboardingMocks } from './shared/onboardingHarness';

test.describe('@ci onboarding wizard', () => {
  test('step 1 loads when host has no organization', async ({ page }) => {
    await installOnboardingMocks(page);
    const orgsReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-organizations') && res.ok()
    );
    await page.goto('/onboarding');
    await orgsReady;
    await expect(page.getByRole('heading', { name: 'Organization' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel(/Organization name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('property listing selection advances to verification step', async ({ page }) => {
    await installOnboardingMocks(page);
    const orgsReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-organizations') && res.ok()
    );
    await page.goto('/onboarding');
    await orgsReady;
    await expect(page.getByRole('heading', { name: 'Organization' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/Organization name/i).fill('Test Host Org');
    await page.waitForResponse(
      (res) => res.url().includes('/functions/v1/check-organization-name') && res.ok()
    );
    await page.getByLabel(/^Contact number/i).fill('09876543210');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Hosting' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('What do you host?')).toBeVisible();

    await page.getByRole('button', { name: 'Property', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Property', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.locator('#unit-number').fill('1234');
    await page.waitForResponse(
      (res) => res.url().includes('/functions/v1/check-tower-unit') && res.ok()
    );
    await page.locator('#property-name').fill('Monaco Test Unit');
    await page.waitForResponse(
      (res) => res.url().includes('/functions/v1/check-property-name') && res.ok()
    );

    await page.locator('#property-rights-rights').click();
    await page.getByRole('option', { name: 'Property Owner' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Verification' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: "Let's get verified" })).toBeVisible();
  });
});
