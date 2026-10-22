import { expect, test, type Page, type Route } from '@playwright/test';

import { mockPublicPropertyBody } from '../../shared/mockFixtures';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * AI Studio → Post. The director is mocked; the poster compiler, offscreen renderer
 * and Design hand-off run for real.
 */

const PHOTO_URL = 'https://e2e-photos.test/living-room.png';
const POSTER_ID = '5b2f6c4e-1d3a-4f8b-9c7e-2a6d8e0f1b3c';
// 2x2 warm-toned PNG: enough for cover-crop math and a real canvas render.
const PHOTO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4v4vhPwMDAwMDEwMDAwAYCAIBxJv1NwAAAABJRU5ErkJggg==',
  'base64'
);

const VARIANTS = [
  {
    archetype: 'magazine-cover',
    fontPairing: 'magazine-cover',
    copy: { headline: 'Slow', accent: 'mornings', tagline: 'Sip slow. Breathe deep.' },
    photoIndexes: [0],
    label: 'Slow mornings',
  },
  {
    archetype: 'sky-headline',
    fontPairing: 'tropical-script',
    copy: { eyebrow: 'Discover a slice of', accent: 'Mactan', headline: 'Beach days, city nights' },
    photoIndexes: [0],
    label: 'Beach days',
  },
  {
    archetype: 'wave-duo',
    fontPairing: 'cozy-cafe',
    copy: { headline: 'Solea', accent: 'Mactan Staycation', chips: ['Coffee', 'View', 'You time'] },
    photoIndexes: [0],
    label: 'Solea staycation',
  },
  {
    archetype: 'minimal-title',
    fontPairing: 'editorial-calm',
    copy: { headline: 'Solea Mactan', eyebrow: 'Stay a while' },
    photoIndexes: [0],
    label: 'Stay a while',
  },
];

async function installPosterMocks(
  page: Page,
  director: (route: Route) => Promise<void>,
  saved: Array<Record<string, unknown>> = []
) {
  await page.route(PHOTO_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: PHOTO_PNG,
    })
  );
  await page.route('**/functions/v1/get-public-property**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...mockPublicPropertyBody,
        data: { ...mockPublicPropertyBody.data, images: [PHOTO_URL] },
      }),
    })
  );
  await page.route('**/functions/v1/generate-marketing-template**', director);
  await page.route('**/functions/v1/marketing-templates**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const record = {
        id: POSTER_ID,
        name: body.name,
        contentType: 'design',
        kind: body.kind ?? null,
        platform: body.platform ?? null,
        aspectPreset: body.aspectPreset ?? null,
        designJson: body.designJson,
        updatedAt: new Date().toISOString(),
      };
      saved.push(record);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: record }),
      });
      return;
    }
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id');
    const view = url.searchParams.get('view');
    const data = id
      ? (saved.find((record) => record.id === id) ?? null)
      : view === 'library'
        ? { items: [], nextCursor: null }
        : view === 'usage'
          ? { usage: [] }
          : { templates: saved };
    await route.fulfill({
      status: data ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(data ? { success: true, data } : { success: false, error: 'Not found' }),
    });
  });
}

function directorResponse(requests: Array<Record<string, unknown>>) {
  return async (route: Route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { contentType: 'poster', variants: VARIANTS, photoUrls: [PHOTO_URL] },
      }),
    });
  };
}

/** Step 1 (what to make) → step 2 (the form) for a property with nothing made yet. */
async function startPost(page: Page) {
  await page.goto(teamRbacPaths.marketingWorkspace);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'What do you want to make?' })).toBeVisible();
  await page
    .getByRole('button', { name: /^Post/ })
    .first()
    .click();
  await expect(page.locator('#ai-studio-composer')).toBeVisible();
}

const generate = (page: Page) => page.getByRole('button', { name: 'Generate 4 posts' });

test.describe('@ci marketing AI Post', () => {
  test.setTimeout(90_000);

  test('a first post sends the poster request and opens four versions', async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests));
    await startPost(page);

    await page.getByRole('button', { name: 'Promo' }).click();
    await page.locator('#ai-studio-prompt').fill('Weekday stays, book direct');
    await generate(page).click();

    // The conversation opens with the batch: best layout first, the rest alongside.
    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: /^Version \d/ })).toHaveCount(4);
    await expect(page.getByText('Version 1 of 4')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Describe a change' })).toBeVisible();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      contentType: 'poster',
      goal: 'promo',
      prompt: 'Weekday stays, book direct',
      photoUrls: [PHOTO_URL],
    });
    expect((requests[0]!.facts as Record<string, unknown>).checkIn).toBe('2:00 PM');
  });

  test('when the director fails, hosts still get posts from quick layouts', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'busy' }),
      })
    );
    await startPost(page);
    await generate(page).click();

    await expect(page.getByText('AI styling is busy. Showing quick layouts instead.')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /^Version \d/ })).toHaveCount(4, {
      timeout: 60_000,
    });
  });

  test('out of credits shows the quota message and no posts', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'AI credits used up', upgradeHook: true }),
      })
    );
    await startPost(page);
    await generate(page).click();

    await expect(page.getByRole('button', { name: 'Buy credits' })).toBeVisible({
      timeout: 30_000,
    });
    // The form stays put: the quota path must not fall back to free quick layouts.
    await expect(generate(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: /^Version \d/ })).toHaveCount(0);
  });

  test('Edit in Posts saves the design and opens it in the Posts editor', async ({ page }) => {
    const saved: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]), saved);
    await startPost(page);
    await generate(page).click();

    const edit = page.getByRole('button', { name: 'Edit in Posts' });
    await expect(edit).toBeEnabled({ timeout: 60_000 });
    await edit.click();

    await expect(page).toHaveURL(new RegExp(`item=${POSTER_ID}`), { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Back to Posts' })).toBeVisible({
      timeout: 20_000,
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      aspectPreset: 'instagram-portrait',
      contentType: 'design',
      kind: 'design',
    });
    const designJson = saved[0]!.designJson as Record<string, unknown>;
    expect(designJson.aiGenerated).toBe(true);
    expect(designJson.posterSpec).toBeTruthy();
    expect((designJson.polotno as { width: number; height: number }).height).toBe(1350);
  });

  test('without the AI generation plan, Generate opens the upgrade modal', async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access', {
      aiMarketingGenerationAllowed: false,
    });
    await installPosterMocks(page, directorResponse(requests));
    await startPost(page);
    await generate(page).click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    expect(requests).toHaveLength(0);
  });
});
