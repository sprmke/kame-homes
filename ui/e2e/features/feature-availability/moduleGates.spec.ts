import { expect, test } from '@playwright/test';

import { installAnalyticsAiReviewRoutes } from '../analytics/shared/aiReviewHarness';
import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

const MAINTENANCE = "We're working on this right now. It'll be back soon.";

const propertyPath = (segment: string) =>
  `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/${segment}`;

test.describe('@ci feature availability — host surfaces', () => {
  test('marketing AI studio tab shows maintenance panel when off', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      featureAvailabilityOff: ['marketing.ai_studio'],
    });
    await page.goto(teamRbacPaths.marketingWorkspace);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Under maintenance').first()).toBeVisible();
    await expect(page.getByText(MAINTENANCE).first()).toBeVisible();
  });

  test('pricing channel sync dialog shows maintenance when modal key is off', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      featureAvailabilityOff: ['pricing.channel_sync'],
    });
    await page.goto(propertyPath('pricing'));
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole('button', { name: /Channel sync/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Under maintenance').first()).toBeVisible();
    await expect(dialog.getByText(MAINTENANCE).first()).toBeVisible();
  });

  test('analytics AI review section shows maintenance when off', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      featureAvailabilityOff: ['analytics.ai_review'],
    });
    await installAnalyticsAiReviewRoutes(page);
    await page.goto(propertyPath('analytics'));
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('tab', { name: 'AI review' }).click();
    await expect(page.getByText('Under maintenance').first()).toBeVisible();
    await expect(page.getByText(MAINTENANCE).first()).toBeVisible();
  });

  test('notifications Telegram hub shows maintenance when off', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      featureAvailabilityOff: ['notifications.telegram'],
    });
    await page.goto(propertyPath('notifications'));
    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Under maintenance').first()).toBeVisible();
  });

  test('inbox Meta threads show maintenance when inbox.meta is off', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      featureAvailabilityOff: ['inbox.meta'],
    });
    await page.goto(propertyPath('inbox'));
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Under maintenance').first()).toBeVisible();
  });
});
