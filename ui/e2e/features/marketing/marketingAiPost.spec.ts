import { expect, test, type Page, type Route } from '@playwright/test';

import { mockPublicPropertyBody } from '../../shared/mockFixtures';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Generate tab → AI Post. The director is mocked; the poster compiler, offscreen
 * renderer and Design hand-off run for real.
 */

const PHOTO_URL = 'https://e2e-photos.test/living-room.png';
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
        id: 'poster-template-1',
        name: body.name,
        contentType: 'design',
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { templates: saved } }),
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

async function openGenerate(page: Page) {
  await page.goto(teamRbacPaths.marketing);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'Generate' }).click();
}

test.describe('@ci marketing AI Post', () => {
  test.setTimeout(90_000);

  test('opens on AI Post, sends the poster request and shows four finished posts', async ({
    page,
  }) => {
    const requests: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse(requests));
    await openGenerate(page);

    await expect(page.getByRole('tab', { name: 'AI Post' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.getByRole('button', { name: 'Promo' }).click();
    await page.getByLabel('What should the post say?').fill('Weekday stays, book direct');
    await page.getByRole('button', { name: 'Generate posts' }).click();

    for (const variant of VARIANTS) {
      await expect(page.getByRole('img', { name: variant.copy.headline, exact: true })).toBeVisible(
        { timeout: 60_000 }
      );
    }
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      contentType: 'poster',
      goal: 'promo',
      prompt: 'Weekday stays, book direct',
      photoUrls: [PHOTO_URL],
    });
    expect((requests[0]!.facts as Record<string, unknown>).checkIn).toBe('2:00 PM');
    await expect(page.getByRole('button', { name: 'Try another layout' })).toHaveCount(4);
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
    await openGenerate(page);
    await page.getByRole('button', { name: 'Generate posts' }).click();

    await expect(page.getByText('AI styling is busy. Showing quick layouts instead.')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Try another layout' })).toHaveCount(4, {
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
    await openGenerate(page);
    await page.getByRole('button', { name: 'Generate posts' }).click();

    await expect(page.getByRole('button', { name: 'Generate posts' })).toBeEnabled({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Buy credits' })).toBeVisible();
    // No poster cards: the quota path must not fall back to free quick layouts.
    await expect(page.getByRole('button', { name: 'Try another layout' })).toHaveCount(0);
  });

  test('Edit saves the poster as a design and opens it in the Design tab', async ({ page }) => {
    const saved: Array<Record<string, unknown>> = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installPosterMocks(page, directorResponse([]), saved);
    await openGenerate(page);
    await page.getByRole('button', { name: 'Generate posts' }).click();

    const edit = page
      .getByRole('button', { name: 'Try another layout' })
      .first()
      .locator('xpath=..')
      .getByRole('button', { name: 'Edit' });
    await expect(edit).toBeEnabled({ timeout: 60_000 });
    await edit.click();

    await expect(page.getByRole('tab', { name: 'Design' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ aspectPreset: 'instagram-portrait', contentType: 'design' });
    const designJson = saved[0]!.designJson as Record<string, unknown>;
    expect(designJson.aiGenerated).toBe(true);
    expect(designJson.posterSpec).toBeTruthy();
    expect((designJson.polotno as { width: number; height: number }).height).toBe(1350);
  });

  test('without the AI generation plan, Generate opens on Photo & video', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', {
      aiMarketingGenerationAllowed: false,
    });
    await openGenerate(page);
    await expect(page.getByRole('tab', { name: 'Photo & video' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 20_000 }
    );
  });
});
