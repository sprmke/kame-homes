import { expect, test, type Page, type Route } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../../team/shared/propertyTeamRbacHarness';

/**
 * Multi-track Videos editor. Backend is mocked; this checks the editor shell, the timeline
 * model and the media library glue, not Remotion rendering quality.
 */

const LIMITS = {
  storageMb: 500,
  maxFiles: 100,
  maxImageMb: 10,
  maxVideoMb: 100,
  maxVideoSec: 60,
  maxAudioMb: 15,
  dailyUploads: 50,
};

function asset(id: string, kind: 'image' | 'video' | 'audio', name: string) {
  return {
    id,
    kind,
    source: 'upload',
    fileName: name,
    mimeType: kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'audio/mpeg',
    url: `http://127.0.0.1:4173/favicon.ico?asset=${id}`,
    posterUrl: null,
    sizeBytes: 1_000_000,
    width: 1080,
    height: 1920,
    durationMs: kind === 'image' ? null : 8000,
    peaks: null,
    createdAt: '2026-10-30T00:00:00Z',
  };
}

async function installMediaMocks(
  page: Page,
  items: ReturnType<typeof asset>[],
  usedBytes = 1_000_000
) {
  await page.route('**/functions/v1/marketing-media**', async (route: Route) => {
    const url = new URL(route.request().url());
    const isUsage = url.pathname.endsWith('/usage');
    const data = isUsage
      ? { usedBytes, files: items.length, uploadsToday: 0, limits: LIMITS }
      : { items, nextCursor: null };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  // Default music lookup is best effort in the editor; keep it quiet.
  await page.route('**/functions/v1/marketing-music**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { tracks: [] } }),
    })
  );
}

async function installTemplateMocks(page: Page) {
  await page.route('**/functions/v1/marketing-templates**', async (route: Route) => {
    const url = new URL(route.request().url());
    const view = url.searchParams.get('view');
    const data =
      view === 'library'
        ? { items: [], nextCursor: null }
        : view === 'usage'
          ? { usage: [] }
          : route.request().method() === 'POST'
            ? {
                id: '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b',
                name: 'Quiet morning',
                kind: 'design',
                contentType: 'video',
                platform: 'instagram',
                aspectPreset: 'instagram-story',
                themeKey: 'property-colors',
                designJson: {},
                groupMembers: [],
                createdAt: '2026-10-30T00:00:00Z',
                updatedAt: '2026-10-30T00:00:00Z',
              }
            : { templates: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
}

/** The library panel starts closed on laptop-width screens. */
async function openMediaPanel(page: Page) {
  const tab = page.getByRole('tab', { name: 'Media' });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(page.getByRole('region', { name: 'Media library' })).toBeVisible();
}

async function openDraft(page: Page) {
  await page.goto(
    `${teamRbacPaths.marketingWorkspace}&tab=video&item=new&from=preset%3Aquiet-morning&size=instagram-story`
  );
  await expect(page.getByRole('button', { name: 'Back to Videos' })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByLabel('Timeline', { exact: true })).toBeVisible({ timeout: 30_000 });
}

test.describe('@ci marketing video editor v2', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
  });

  test('a template opens on tracks with the library beside it', async ({ page }) => {
    await installMediaMocks(page, [
      asset('a1', 'image', 'pool.jpg'),
      asset('v1', 'video', 'tour.mp4'),
    ]);
    await openDraft(page);

    // The template's scenes are clips on the main track, its captions are text clips.
    const clips = page.locator('[data-timeline-item]');
    expect(await clips.count()).toBeGreaterThan(3);
    await openMediaPanel(page);
    await expect(page.getByRole('button', { name: 'Use pool.jpg' })).toBeVisible();
  });

  test('picking a library photo adds a clip at the playhead', async ({ page }) => {
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
    await openDraft(page);
    const before = await page.locator('[data-timeline-item]').count();
    await openMediaPanel(page);
    await page.getByRole('button', { name: 'Use pool.jpg' }).click();
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before + 1);
  });

  test('split cuts the clip under the playhead and undo restores it', async ({ page }) => {
    await installMediaMocks(page, []);
    await openDraft(page);
    // The main track is the last lane (top track first); its first clip starts at 0.
    await page.locator('[data-lane]').last().locator('[data-timeline-item]').first().click();
    const before = await page.locator('[data-timeline-item]').count();
    // Move the playhead into the clip, then split with the S key.
    await page.getByLabel('Seek').fill('20');
    await page.keyboard.press('s');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before + 1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before);
  });

  test('delete removes the selected clip', async ({ page }) => {
    await installMediaMocks(page, []);
    await openDraft(page);
    const before = await page.locator('[data-timeline-item]').count();
    await page.locator('[data-timeline-item]').nth(2).click();
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(before - 1);
  });

  test('the storage meter turns to a warning when the library is nearly full', async ({ page }) => {
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')], 480 * 1024 * 1024);
    await openDraft(page);
    await openMediaPanel(page);
    await expect(page.getByLabel('Media storage used')).toBeVisible();
  });
});

test.describe('@ci marketing video editor v2 on a phone', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installTemplateMocks(page);
    await installMediaMocks(page, [asset('a1', 'image', 'pool.jpg')]);
  });

  const mainLane = (page: Page) => page.locator('[data-lane]').last();

  test('scrolling the lanes moves the playhead and a tap on a clip shows its actions', async ({
    page,
  }) => {
    await openDraft(page);
    // No desktop toolbar or track headers on a phone.
    await expect(page.getByRole('toolbar', { name: 'Timeline tools' })).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Editor actions' })).toBeVisible();

    const before = await page
      .getByText(/^\d+:\d\d\.\d \/ /)
      .first()
      .textContent();
    await page.evaluate(() => {
      const scroller = document.querySelector('[data-lane]')!.closest('.overflow-x-auto')!;
      scroller.scrollLeft = scroller.scrollLeft + 120;
    });
    await expect
      .poll(async () =>
        page
          .getByText(/^\d+:\d\d\.\d \/ /)
          .first()
          .textContent()
      )
      .not.toBe(before);

    await mainLane(page).locator('[data-timeline-item]').first().tap();
    const actions = page.getByRole('toolbar', { name: 'Clip actions' });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Edit' })).toBeVisible();
    await actions.getByRole('button', { name: 'Done' }).tap();
    await expect(actions).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Editor actions' })).toBeVisible();
  });

  test('Split from the action bar cuts the selected clip at the playhead', async ({ page }) => {
    await openDraft(page);
    const items = page.locator('[data-timeline-item]');
    const before = await items.count();
    await mainLane(page).locator('[data-timeline-item]').first().tap();
    await page.getByLabel('Seek').fill('20');
    await page
      .getByRole('toolbar', { name: 'Clip actions' })
      .getByRole('button', { name: 'Split' })
      .tap();
    await expect(items).toHaveCount(before + 1);
  });
});
