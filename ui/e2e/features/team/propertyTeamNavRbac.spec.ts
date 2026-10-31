import { expect, test } from '@playwright/test';

import {
  expectNavLinkHidden,
  expectNavLinkVisible,
  expectOnAllowedPropertySection,
  installPropertyTeamRbacMocks,
  openPropertyDashboard,
  teamRbacPaths,
} from './shared/propertyTeamRbacHarness';

test.describe('@smoke @ci property team RBAC nav smoke', () => {
  test('Full Access shows Finance, Marketing, Settings, and Team', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openPropertyDashboard(page);

    await expectNavLinkVisible(page, 'Bookings');
    await expectNavLinkVisible(page, 'Finance');
    await expectNavLinkVisible(page, 'Marketing');
    await expectNavLinkVisible(page, 'Settings');
    await expectNavLinkVisible(page, 'Team');
    await expectNavLinkVisible(page, 'Inbox');
  });

  test('Operations shows Marketing and Bookings; hides Finance and Settings', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'operations');
    await openPropertyDashboard(page);

    await expectNavLinkVisible(page, 'Bookings');
    await expectNavLinkVisible(page, 'Maintenance');
    await expectNavLinkVisible(page, 'Marketing');
    await expectNavLinkVisible(page, 'Inbox');
    await expectNavLinkVisible(page, 'Pricing');

    await expectNavLinkHidden(page, 'Finance');
    await expectNavLinkHidden(page, 'Settings');
    await expectNavLinkHidden(page, 'Team');
    await expectNavLinkHidden(page, 'Plans & Billing');
  });

  test('Read Only hides Marketing, Finance, and Settings', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'read_only');
    await openPropertyDashboard(page);

    await expectNavLinkVisible(page, 'Bookings');
    await expectNavLinkVisible(page, 'Maintenance');
    await expectNavLinkVisible(page, 'Pricing');
    await expectNavLinkVisible(page, 'Team');
    await expectNavLinkVisible(page, 'Inbox');

    await expectNavLinkHidden(page, 'Marketing');
    await expectNavLinkHidden(page, 'Finance');
    await expectNavLinkHidden(page, 'Settings');
    await expectNavLinkHidden(page, 'Plans & Billing');
  });

  test('Operations deep-link to Finance redirects away from /finance', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'operations');
    await page.goto(teamRbacPaths.finance);

    await expect(page).not.toHaveURL(/\/finance(\?|$)/, { timeout: 20_000 });
    await expectOnAllowedPropertySection(page);
  });

  test('Read Only deep-link to Marketing redirects away from /marketing', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'read_only');
    await page.goto(teamRbacPaths.marketing);

    await expect(page).not.toHaveURL(/\/marketing(\?|$)/, { timeout: 20_000 });
    await expectOnAllowedPropertySection(page);
  });

  test('Operations can open Marketing route', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'operations');
    await page.goto(teamRbacPaths.marketing);

    await expect(page).toHaveURL(/\/marketing(\?|$)/, { timeout: 20_000 });
    await expectNavLinkVisible(page, 'Marketing');
  });
});
