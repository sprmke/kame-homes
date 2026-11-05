import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * AI Studio examples: the gallery on the home, the detail view, and how Use this
 * example fills the create form. Picking an example never generates anything.
 */
async function openStudio(page: Page) {
  await page.goto(teamRbacPaths.marketingWorkspace);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
}

const examples = (page: Page) => page.getByRole('region', { name: 'Examples' }).first();

async function openExample(page: Page, title: string) {
  await examples(page)
    .getByRole('button', { name: new RegExp(`^${title}, post example`) })
    .click();
  const detail = page.getByRole('dialog', { name: title });
  await expect(detail).toBeVisible();
  return detail;
}

test.describe('@ci marketing AI Studio examples', () => {
  test('the home shows examples, and an example opens with how it was made', async ({ page }) => {
    const generateCalls: string[] = [];
    page.on('request', (req) => {
      if (/generate-marketing-(media|template)/.test(req.url())) generateCalls.push(req.url());
    });
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openStudio(page);

    await expect(page.getByRole('heading', { name: 'Start from an example' })).toBeVisible();
    await expect(
      examples(page).getByRole('button', { name: /^Weekend escape, post example/ })
    ).toBeVisible();

    const detail = await openExample(page, 'Book direct');
    await expect(detail.getByText('Example', { exact: true })).toBeVisible();
    await expect(detail.getByText('Book direct for weekday stays')).toBeVisible();
    await expect(detail.getByText('Promo')).toBeVisible();
    await expect(detail.getByText('Uses your listing photos')).toBeVisible();

    // Stepping between examples, then closing, generates nothing.
    await detail.getByRole('button', { name: 'Next example' }).click();
    await expect(page.getByRole('dialog', { name: 'Amenity spotlight' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('dialog', { name: 'Book direct' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(generateCalls).toEqual([]);
  });

  test('Use this example fills the form and the URL; Clear resets both', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openStudio(page);

    const detail = await openExample(page, 'Book direct');
    await detail.getByRole('button', { name: 'Use this example' }).click();

    await expect(page.locator('#ai-studio-composer')).toBeVisible();
    await expect(page).toHaveURL(/sample=post-book-direct/);
    await expect(page.getByText('Using example')).toBeVisible();
    await expect(page.locator('#ai-studio-prompt')).toHaveValue('Book direct for weekday stays');
    await expect(page.getByRole('radio', { name: /Promo/ })).toBeChecked();

    // Editing keeps the example as a starting point.
    await page.locator('#ai-studio-prompt').fill('Book direct for long weekends');
    await expect(page.getByText('Based on')).toBeVisible();

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page).not.toHaveURL(/sample=/);
    await expect(page.locator('#ai-studio-prompt')).toHaveValue('');
    await expect(page.getByRole('radio', { name: /Vibe/ })).toBeChecked();
  });

  test('picking an example over typed words can be undone', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openStudio(page);
    await page.getByRole('button', { name: /^Post/ }).first().click();
    await expect(page.locator('#ai-studio-composer')).toBeVisible();

    await page.locator('#ai-studio-prompt').fill('Our rooftop is open again');
    const pane = page.locator('[aria-label="Preview"]');
    await expect(pane.getByText('Pick an example or describe your own')).toBeVisible();
    await pane.getByRole('button', { name: /^Night in, post example/ }).click();
    await page
      .getByRole('dialog', { name: 'Night in' })
      .getByRole('button', { name: 'Use this example' })
      .click();

    await expect(page.locator('#ai-studio-prompt')).toHaveValue('Late check-out on weekday stays');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('#ai-studio-prompt')).toHaveValue('Our rooftop is open again');
    await expect(page).not.toHaveURL(/sample=/);
  });

  test('a post example sends its layout and stays a normal Generate', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    let sent: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/generate-marketing-template**', async (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'busy' }),
      });
    });
    await openStudio(page);

    const detail = await openExample(page, 'Book direct');
    await detail.getByRole('button', { name: 'Use this example' }).click();
    await page
      .locator('#ai-studio-composer')
      .getByRole('button', { name: /Generate 4 posts/ })
      .click();

    await expect.poll(() => sent).not.toBeNull();
    expect(sent).toMatchObject({
      contentType: 'poster',
      goal: 'promo',
      prompt: 'Book direct for weekday stays',
      preferredArchetype: 'sky-headline',
    });
  });

  test('an unknown example in the URL is dropped quietly', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(
      `${teamRbacPaths.marketingWorkspace}&tab=generate&item=new&output=post&sample=not-a-real-example`
    );
    await expect(page.locator('#ai-studio-composer')).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/sample=/);
    await expect(page.getByText('Using example')).toHaveCount(0);
    await expect(page.locator('#ai-studio-prompt')).toHaveValue('');
  });
});

test.describe('marketing AI Studio examples screens', () => {
  test.skip(!process.env.PLAYWRIGHT_CAPTURE_SCREENS, 'Set PLAYWRIGHT_CAPTURE_SCREENS=1 to capture');
  for (const viewport of [
    { name: 'phone', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 960 },
  ]) {
    test(`captures the gallery and detail on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await installPropertyTeamRbacMocks(page, 'full_access');
      await openStudio(page);
      await page.waitForTimeout(4_000);
      await page.screenshot({
        path: `test-results/ai-examples/${viewport.name}-home.png`,
        fullPage: true,
      });
      await openExample(page, 'Weekend escape');
      await page.waitForTimeout(1_500);
      await page.screenshot({ path: `test-results/ai-examples/${viewport.name}-detail.png` });
      await page
        .getByRole('dialog', { name: 'Weekend escape' })
        .getByRole('button', { name: 'Use this example' })
        .click();
      await page.waitForTimeout(2_000);
      await page.screenshot({ path: `test-results/ai-examples/${viewport.name}-form.png` });
    });
  }
});
