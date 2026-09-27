import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci host AI settings are toggle-only', () => {
  test('org settings expose the AI switch and usage, never a limit input', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/settings`);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator('#section-ai').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'AI features', exact: true })).toBeVisible();
    await expect(page.getByLabel('Enable AI for organization')).toBeVisible();
    // Progressive disclosure: assistant + usage only when org AI is on (mock defaults on).
    await expect(page.getByLabel('Enable dashboard assistant')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Dashboard assistant', exact: true })
    ).toBeVisible();
    await expect(page.locator('#section-ai-assistant')).toHaveCount(0);
    await expect(page.getByLabel('Enable AI for this property')).toHaveCount(0);

    for (const label of [
      /AI call limit/i,
      /AI cost/i,
      /assistant message limit/i,
      /write-action limit/i,
    ]) {
      await expect(page.getByLabel(label)).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: /Save AI limits/i })).toHaveCount(0);
  });

  test('toggling AI sends only the enabled flag', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    await page.goto(`/org/${TEAM_E2E_ORG_SLUG}/settings`);
    await page.locator('#section-ai').scrollIntoViewIfNeeded();

    const patch = page.waitForRequest(
      (req) => req.url().includes('/functions/v1/ai-platform-settings') && req.method() === 'PATCH'
    );
    await page.getByLabel('Enable AI for organization').click();
    const body = (await patch).postDataJSON() as Record<string, unknown>;
    expect(body).toEqual({ enabled: false });
  });
});
