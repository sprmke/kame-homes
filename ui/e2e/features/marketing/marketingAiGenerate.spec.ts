import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Studio "Generate" tab — the seeded gallery job's prompt text doubles as
 * a render assertion for both the composer path and the view-past-output path.
 */
const SEEDED_PROMPT = 'E2E fixture: sunset shot of the rooftop pool deck';

const modeSwitch = (page: Page) => page.getByRole('tablist', { name: 'What to generate' });

/** Generate opens on AI Post when the plan has it; these specs cover Photo and Video. */
async function openGenerateMode(page: Page, mode: 'Photo' | 'Video' = 'Photo') {
  await page.getByRole('tab', { name: 'Generate' }).click();
  await modeSwitch(page).getByRole('tab', { name: mode, exact: true }).click();
}

async function openCardMenu(page: Page) {
  await page.getByRole('button', { name: 'More actions for this photo' }).first().click();
}

test.describe('@ci marketing AI generate tab', () => {
  test('Pro+ composer is usable and the gallery shows a completed generation', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await openGenerateMode(page);

    await expect(page.getByPlaceholder(/balcony at golden hour/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Format' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Quality' })).toBeVisible();
    await expect(page.getByRole('button', { name: /More options/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add photos/ })).toBeVisible();

    await expect(page.getByText(SEEDED_PROMPT)).toBeVisible();
  });

  test('Business+ can switch to Video and open more video options', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await openGenerateMode(page, 'Video');

    await expect(page.getByRole('radiogroup', { name: 'Format' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Length' })).toBeVisible();
    await page.getByRole('button', { name: /More options/ }).click();
    const resolution = page.getByRole('tablist', { name: 'Resolution' });
    await expect(resolution.getByRole('tab', { name: /High \(1080p\)/ })).toBeEnabled();
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

    await openGenerateMode(page, 'Video');
    await expect(modeSwitch(page).getByRole('tab', { name: 'Video', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );

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

    await openGenerateMode(page);

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

    await openGenerateMode(page);
    await openCardMenu(page);
    await page.getByRole('menuitem', { name: 'Use these settings' }).click();
    await expect(page.locator('#ai-studio-prompt')).toHaveValue(SEEDED_PROMPT);
  });

  test('the photo chooser lists saved uploads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await openGenerateMode(page);
    await page.getByRole('button', { name: /Add photos/ }).click();
    const chooser = page.getByRole('dialog', { name: 'Choose photos' });
    await expect(chooser).toBeVisible();
    const uploadsTab = chooser.getByRole('tab', { name: /Uploads/ });
    if (await uploadsTab.isVisible()) await uploadsTab.click();
    await expect(page.getByRole('button', { name: /Use balcony\.jpg/i })).toBeVisible();
  });

  test('Add to my photos attaches the generation to the form', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await openGenerateMode(page);
    await openCardMenu(page);
    await page.getByRole('menuitem', { name: 'Add to my photos' }).click();
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  });

  test('a role without the image leaf cannot generate images', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'operations');
    await page.goto(teamRbacPaths.marketing);
    await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({
      timeout: 20_000,
    });

    await openGenerateMode(page);
    await expect(page.getByText(/do not have permission to generate photos/i)).toBeVisible();
    const composer = page.locator('#ai-studio-composer');
    await expect(composer.getByRole('button', { name: /generate/i })).toBeDisabled();

    await modeSwitch(page).getByRole('tab', { name: 'Video', exact: true }).click();
    await expect(page.getByText(/do not have permission to generate videos/i)).toBeVisible();
    await expect(composer.getByRole('button', { name: /generate/i })).toBeDisabled();
  });
});
