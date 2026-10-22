import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * AI Studio, photo and clip. Step 1 picks what to make, step 2 is one short form,
 * and a finished creation opens as a conversation with its versions.
 */
const SEEDED_TITLE = 'Sunset shot of the rooftop pool deck';

const startCard = (page: Page, title: 'Post' | 'Photo' | 'Clip') =>
  page.getByRole('button', { name: new RegExp(`^${title}`) }).first();

async function openStudio(page: Page) {
  await page.goto(teamRbacPaths.marketingWorkspace);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
}

/** Step 1 → step 2, for a property with nothing made yet. */
async function startNew(page: Page, title: 'Post' | 'Photo' | 'Clip') {
  await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
  await startCard(page, title).click();
  await expect(page.locator('#ai-studio-composer')).toBeVisible();
}

test.describe('@ci marketing AI generate tab', () => {
  test('starting a photo opens one short form with everything else under Advanced', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openStudio(page);
    await startNew(page, 'Photo');

    await expect(page.getByRole('button', { name: 'Back to AI Studio' })).toBeVisible();
    await expect(page.getByText('New photo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose' })).toHaveCount(0);
    await expect(page.locator('#ai-studio-prompt')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add photos/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Size' })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();

    // Quality, look and image size stay out of the way until asked for.
    await expect(page.getByRole('tablist', { name: 'Quality' })).toHaveCount(0);
    await page.getByRole('button', { name: /Advanced/ }).click();
    await expect(page.getByRole('tablist', { name: 'Quality' })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Image size' })).toBeVisible();
  });

  test('Clip sends the camera move, sound and an 8s length', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    let sent: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/generate-marketing-media**', async (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Generation failed' }),
      });
    });
    await openStudio(page);
    await startNew(page, 'Clip');

    await page.locator('#ai-studio-prompt').fill('Curtains moving in a soft breeze');
    await page.getByRole('button', { name: /Advanced/ }).click();
    await page.getByRole('radio', { name: 'Orbit' }).click();
    await page.getByRole('tablist', { name: 'Sound' }).getByRole('tab', { name: 'Music' }).click();
    await page
      .locator('#ai-studio-composer')
      .getByRole('button', { name: /generate/i })
      .click();

    await expect.poll(() => sent).not.toBeNull();
    expect(sent).toMatchObject({
      mediaType: 'video',
      prompt: 'Curtains moving in a soft breeze',
      cameraMove: 'orbit',
      sound: 'music',
      durationSeconds: 8,
      resolution: '1080p',
      enhancePrompt: true,
    });
  });

  test('below Business, Generate opens the upgrade modal and sends nothing', async ({ page }) => {
    const generateCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/functions/v1/generate-marketing-media'))
        generateCalls.push(req.url());
    });
    await installPropertyTeamRbacMocks(page, 'full_access', { videoPlanAllowed: false });
    await openStudio(page);
    await startNew(page, 'Clip');

    await page.locator('#ai-studio-prompt').fill('Slow pan across the living room');
    await page
      .locator('#ai-studio-composer')
      .getByRole('button', { name: /generate/i })
      .click();

    await expect(page.getByRole('dialog')).toBeVisible();
    expect(generateCalls).toEqual([]);
  });

  test('the photo chooser lists saved uploads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await openStudio(page);

    await page.getByRole('button', { name: 'New photo' }).click();
    await expect(page.locator('#ai-studio-composer')).toBeVisible();
    await page.getByRole('button', { name: /Add photos/ }).click();
    const chooser = page.getByRole('dialog', { name: 'Choose photos' });
    await expect(chooser).toBeVisible();
    const uploadsTab = chooser.getByRole('tab', { name: /Uploads/ });
    if (await uploadsTab.isVisible()) await uploadsTab.click();
    await expect(page.getByRole('button', { name: /Use balcony\.jpg/i })).toBeVisible();
  });

  test('a finished photo opens as a conversation with its versions', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { marketingGenerationSeeded: true });
    await openStudio(page);

    await expect(page.getByText('Your creations')).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`^Open ${SEEDED_TITLE}`) }).click();

    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Version 1/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Describe a change' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

    // Back returns to the creations grid without leaving the tab.
    await page.getByRole('button', { name: 'Back to AI Studio' }).click();
    await expect(page.getByText('Your creations')).toBeVisible();
  });

  test('a role without the photo permission cannot start one', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'operations');
    await openStudio(page);

    await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
    await expect(startCard(page, 'Photo')).toBeDisabled();
    await expect(startCard(page, 'Clip')).toBeDisabled();
    await expect(page.getByText('Ask the owner for access').first()).toBeVisible();
  });
});
