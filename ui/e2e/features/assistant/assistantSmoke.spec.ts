import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  openPropertyDashboard,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@smoke assistant shell', () => {
  test('assistant enabled loads bookings shell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', { assistantEnabled: true });
    page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE', msg.text());
    });
    await openPropertyDashboard(page);
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
