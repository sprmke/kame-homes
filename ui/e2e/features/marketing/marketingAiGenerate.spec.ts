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
  });

  test('below Business, Video opens upgrade and Image stays usable', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { videoPlanAllowed: false });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Generate' }).click();

    const mediaType = page.getByRole('tablist', { name: 'Media type' });
    const videoToggle = mediaType.getByRole('tab', { name: /Video/ });
    await expect(videoToggle).toBeEnabled();
    await videoToggle.click();

    await expect(mediaType.getByRole('tab', { name: 'Image' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByPlaceholder(/balcony at golden hour/i)).toBeVisible();
  });

  test('below Pro, the composer is gated but past generations stay visible and downloadable', async ({
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

    await expect(page.getByText('AI image generation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'View plans' })).toBeVisible();
    await expect(page.getByPlaceholder(/balcony at golden hour/i)).toHaveCount(0);

    await expect(page.getByText(SEEDED_PROMPT)).toBeVisible();
    await expect(page.getByRole('link', { name: /download/i })).toBeVisible();
  });
});
