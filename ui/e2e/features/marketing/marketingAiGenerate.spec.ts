import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Studio "Generate" tab — the seeded gallery job's prompt text doubles as
 * a render assertion for both the composer path and the view-past-output path.
 */
const SEEDED_PROMPT = 'E2E fixture: sunset shot of the rooftop pool deck';

test.describe('@ci marketing AI generate tab', () => {
  test('Pro+ composer is usable and the gallery shows a completed generation', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();

    await expect(page.getByPlaceholder(/balcony at golden hour/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Shape' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Advanced/ })).toBeVisible();
    await expect(page.getByText(/Drop photos or click/i)).toBeVisible();

    await expect(page.getByText(SEEDED_PROMPT)).toBeVisible();
  });

  test('Business+ can toggle to Video and open advanced video options', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();

    const mediaType = page.getByRole('tablist', { name: 'Media type' });
    const videoToggle = mediaType.getByRole('tab', { name: /^Video/ });
    await expect(videoToggle).toBeEnabled();
    await videoToggle.click();

    await expect(page.getByRole('radiogroup', { name: 'Shape' })).toBeVisible();
    await page.getByRole('button', { name: /Advanced/ }).click();
    await expect(page.getByText('Resolution', { exact: true })).toBeVisible();
    await expect(page.getByText('Length', { exact: true })).toBeVisible();
    await page.getByLabel('Resolution').click();
    await expect(page.getByRole('option', { name: /High \(1080p\)/ })).toBeVisible();
  });

  test('below Business, Video stays selectable and Generate does not submit', async ({ page }) => {
    const generateCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/functions/v1/generate-marketing-media'))
        generateCalls.push(req.url());
    });
    await installPropertyTeamRbacMocks(page, 'full_access', { videoPlanAllowed: false });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();

    const mediaType = page.getByRole('tablist', { name: 'Media type' });
    const videoToggle = mediaType.getByRole('tab', { name: /^Video/ });
    await expect(videoToggle).toBeEnabled();
    await videoToggle.click();
    await expect(videoToggle).toHaveAttribute('aria-selected', 'true');

    await page.locator('#ai-studio-prompt').fill('Slow pan across the living room');
    await page
      .locator('#ai-studio-composer')
      .getByRole('button', { name: /generate/i })
      .click();
    // The plan gate intercepts the submit: no generation request leaves the browser.
    await page.waitForTimeout(500);
    expect(generateCalls).toEqual([]);
  });

  test('below Pro, the composer stays open, Generate opens the upgrade modal, and past generations stay downloadable', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      freePlan: true,
      marketingGenerationSeeded: true,
    });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();

    await page.locator('#ai-studio-prompt').fill('Sunset over the rooftop pool');
    await page
      .locator('#ai-studio-composer')
      .getByRole('button', { name: /generate/i })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText(SEEDED_PROMPT)).toBeVisible();
    await expect(page.getByRole('link', { name: /download/i })).toBeVisible();
  });

  test('Retry copies the generation back into the composer', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('#ai-studio-prompt')).toHaveValue(SEEDED_PROMPT);
  });

  test('Library drawer lists saved photos', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();
    await page.getByRole('button', { name: 'Library' }).click();
    await expect(page.getByRole('dialog', { name: 'Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Use balcony\.jpg/i })).toBeVisible();
  });

  test('Use photo adds the generation to Photos', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();
    await page.getByRole('button', { name: 'Use photo' }).click();
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  });

  test('a role without the image leaf cannot generate images', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'operations');
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();

    const mediaType = page.getByRole('tablist', { name: 'Media type' });
    await expect(
      mediaType.getByRole('tab', { name: /Image\. You do not have permission/ })
    ).toBeDisabled();
    await expect(
      mediaType.getByRole('tab', { name: /Video\. You do not have permission/ })
    ).toBeDisabled();
    await expect(page.getByText(/do not have permission to generate/i)).toBeVisible();
  });
});
