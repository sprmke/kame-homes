import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci inbox AI handoff badge', () => {
  test('a thread with ai_handoff_at set shows the "Needs you" badge', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox?mock=true`);
    await expect(page.getByRole('heading', { name: 'Guest Inbox' })).toBeVisible({
      timeout: 20_000,
    });

    const row = page.getByRole('button', { name: /Carlo Mendoza/ });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Needs you')).toBeVisible();
  });

  test('a thread with no ai_handoff_at does not show the badge', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/inbox?mock=true`);
    await expect(page.getByRole('heading', { name: 'Guest Inbox' })).toBeVisible({
      timeout: 20_000,
    });

    const row = page.getByRole('button', { name: /Maria Santos/ });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Needs you')).toHaveCount(0);
  });
});
