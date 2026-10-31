import { expect, test } from '@playwright/test';

import { installFeatureAvailabilityAdminMocks } from './superAdminFeatureAvailabilityHarness';

test.describe('@ci super admin feature availability', () => {
  test('turns a catalog feature off through the dialog', async ({ page }) => {
    const { putBodies } = await installFeatureAvailabilityAdminMocks(page);
    await page.goto('/admin/feature-availability');
    await expect(
      page.getByRole('heading', { name: 'Feature availability', exact: true })
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole('switch', { name: 'AI studio on' }).click();
    await expect(page.getByRole('heading', { name: 'Turn off AI studio' })).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => putBodies.length).toBe(1);
    expect(putBodies[0]).toMatchObject({
      featureKey: 'marketing.ai_studio',
      isEnabled: false,
      reason: 'maintenance',
    });
    await expect(page.getByRole('switch', { name: 'AI studio off' })).toBeVisible();
    await expect(page.getByText('Under maintenance').first()).toBeVisible();
  });
});
