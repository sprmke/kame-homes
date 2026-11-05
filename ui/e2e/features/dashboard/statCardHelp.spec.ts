import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Stat cards use a stretched overlay link/button so a title hint is never
 * nested inside another interactive element. These tests cover the behavior
 * that the refactor is easy to break.
 */
async function openDashboard(page: import('@playwright/test').Page) {
  await page.goto(teamRbacPaths.dashboard);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({
    timeout: 20_000,
  });
}
test.describe('@ci stat card help', () => {
  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
  });

  test('hint on a linked card opens without navigating and is not nested', async ({ page }) => {
    await openDashboard(page);

    const hint = page.getByRole('button', { name: 'About Total Bookings' });
    await expect(hint).toBeVisible({ timeout: 20_000 });

    const nestedInInteractive = await hint.evaluate((el) =>
      Boolean(el.parentElement?.closest('a,button'))
    );
    expect(nestedInInteractive).toBe(false);

    await hint.hover();
    await expect(page.getByRole('tooltip')).toContainText('Nights booked out of the nights');

    const urlBefore = page.url();
    await hint.click();
    await expect(page.getByRole('tooltip')).toBeVisible();
    expect(page.url()).toBe(urlBefore);
  });

  test('the card body still navigates to bookings', async ({ page }) => {
    await openDashboard(page);

    await page.getByRole('link', { name: /^Total Bookings:/ }).click();

    await expect(page).toHaveURL(/\/bookings\?/);
  });

  test('every KPI card renders its hint outside the card control', async ({ page }) => {
    await openDashboard(page);

    const hints = page.getByRole('button', {
      name: /^About (Total Revenue|Total Bookings|Occupancy Rate|Average Nightly Rate)$/,
    });
    await expect(hints).toHaveCount(4, { timeout: 20_000 });

    const nested = await hints.evaluateAll(
      (elements) => elements.filter((el) => Boolean(el.parentElement?.closest('a,button'))).length
    );
    expect(nested).toBe(0);
  });
});

test.describe('@smoke stat card help on touch', () => {
  test.use({ hasTouch: true });

  test('opens on tap at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openDashboard(page);

    const hint = page.getByRole('button', { name: 'About Total Revenue' });
    await expect(hint).toBeVisible({ timeout: 20_000 });
    const urlBefore = page.url();
    await hint.tap();

    await expect(page.getByRole('tooltip')).toContainText('What you keep from bookings');
    expect(page.url()).toBe(urlBefore);
  });
});
