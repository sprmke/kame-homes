import { expect, test } from '@playwright/test';

import { installPropertyTeamRbacMocks, orgHubPaths } from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci org hub shells', () => {
  test.describe.configure({ mode: 'serial' });

  test('org dashboard loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    const statsReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/dashboard-stats') && res.ok()
    );
    await page.goto(orgHubPaths.dashboard);
    await statsReady;
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('org bookings list loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(orgHubPaths.bookings);
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('org properties inventory loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    const propertiesReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-properties') && res.ok()
    );
    await page.goto(orgHubPaths.properties);
    await propertiesReady;
    await expect(page.getByRole('heading', { name: 'Properties', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Solea Mactan').first()).toBeVisible();
  });

  test('org team page loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    const teamReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/org-team-members') && res.ok()
    );
    await page.goto(orgHubPaths.team);
    await teamReady;
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('org activity log loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    const activityReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-activity-log') && res.ok()
    );
    await page.goto(`/org/kame-homes-ph/activity`);
    await activityReady;
    await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('searchbox', { name: 'Search activity' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });
});
