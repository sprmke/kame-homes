import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';

test.describe('@ci accept invite', () => {
  test('missing token shows invalid invitation message', async ({ page }) => {
    await page.goto('/accept-invite');
    await expect(page.getByText('This invitation link is invalid.')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('expired token preview shows invalid invitation message', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-team-invite-preview',
        status: 404,
        body: { success: false, error: 'Invitation not found' },
      },
    ]);
    await page.goto('/accept-invite?token=expired-e2e-token&scope=property');
    await expect(page.getByText(/invalid|not found/i)).toBeVisible({ timeout: 20_000 });
  });
});
