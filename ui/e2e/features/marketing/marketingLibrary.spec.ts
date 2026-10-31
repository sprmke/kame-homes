import { expect, test, type Page, type Route } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing Library (Posts / Videos / Calendar homes) and the save model:
 * templates open as unsaved drafts, nothing is stored until the host edits, and
 * copies only happen on purpose (Duplicate, Save as template).
 */

const ITEM_A = '0f6f4a51-7a2b-4c3d-8e9f-1a2b3c4d5e6f';
const ITEM_B = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function libraryItem(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    kind: 'design',
    contentType: 'design',
    platform: 'instagram',
    aspectPreset: 'instagram-post',
    themeKey: 'property-colors',
    groupId: null,
    sourceTemplateId: 'preset:promo-500-off',
    thumbnailUrl: null,
    aiGenerated: false,
    isCollage: false,
    themeHash: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-19T00:00:00Z',
    deletedAt: null,
    groupSize: 1,
    groupMembers: [{ id, aspectPreset: 'instagram-post', updatedAt: '2026-10-19T00:00:00Z' }],
    ...overrides,
  };
}

type Captured = { method: string; url: URL; body: Record<string, unknown> | null };

async function installLibraryMocks(page: Page, items: unknown[], captured: Captured[]) {
  await page.route('**/functions/v1/marketing-templates**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body =
      request.method() === 'GET' ? null : (request.postDataJSON() as Record<string, unknown>);
    captured.push({ method: request.method(), url, body });
    const view = url.searchParams.get('view');
    let data: unknown = { templates: [] };
    if (request.method() === 'GET' && view === 'library') {
      const kind = url.searchParams.get('kind') ?? 'design';
      data = { items: kind === 'design' ? items : [], nextCursor: null };
    } else if (request.method() === 'GET' && view === 'usage') {
      data = { usage: [] };
    } else if (request.method() === 'POST') {
      data = {
        ...libraryItem('9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b', `${String(body?.name ?? 'Copy')}`),
        designJson: {},
      };
    } else if (request.method() === 'DELETE') {
      data = { deleted: true, ids: (body?.ids as string[]) ?? [] };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
}

async function openPosts(page: Page) {
  await page.goto(teamRbacPaths.marketingWorkspace);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'Posts' }).click();
}

test.describe('@ci marketing library', () => {
  test.setTimeout(90_000);

  test('a template opens as a draft and nothing is saved until the host edits', async ({
    page,
  }) => {
    const captured: Captured[] = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installLibraryMocks(page, [], captured);
    await openPosts(page);

    await expect(page.getByRole('heading', { name: 'Make your first post' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Promos' })).toBeVisible();
    await page.getByRole('button', { name: '₱500 off' }).first().click();
    await expect(page).toHaveURL(/item=new.*from=preset%3Apromo-500-off|from=preset:promo-500-off/);
    await expect(page.getByRole('button', { name: 'Back to Posts' })).toBeVisible({
      timeout: 30_000,
    });

    // Longer than the autosave debounce: an untouched draft must never be stored.
    await page.waitForTimeout(4_000);
    expect(captured.filter((call) => call.method !== 'GET')).toEqual([]);

    await page.getByRole('button', { name: 'Back to Posts' }).click();
    await expect(page.getByRole('heading', { name: 'Make your first post' })).toBeVisible();
  });

  test('returning hosts see their designs first; Duplicate and Delete are explicit', async ({
    page,
  }) => {
    const captured: Captured[] = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installLibraryMocks(
      page,
      [libraryItem(ITEM_A, 'Weekday promo'), libraryItem(ITEM_B, 'Summer sale')],
      captured
    );
    await openPosts(page);

    await expect(page.getByRole('button', { name: 'Open Weekday promo' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Open Summer sale' })).toBeVisible();

    await page.getByRole('button', { name: 'Weekday promo options' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect
      .poll(() => captured.find((call) => call.method === 'POST')?.body ?? null)
      .toMatchObject({ action: 'duplicate', id: ITEM_A });
    // Let the first menu finish closing before opening the next one.
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Summer sale options' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect
      .poll(() => captured.find((call) => call.method === 'DELETE')?.body ?? null)
      .toMatchObject({ ids: [ITEM_B], permanent: false });
    await expect(page.getByText('Moved to Recently deleted')).toBeVisible();
  });

  test('opening a design pushes the editor; Back pops to the Library', async ({ page }) => {
    const captured: Captured[] = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installLibraryMocks(page, [libraryItem(ITEM_A, 'Weekday promo')], captured);
    await page.route(`**/functions/v1/marketing-templates?*id=${ITEM_A}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...libraryItem(ITEM_A, 'Weekday promo'),
            designJson: {
              polotno: {
                width: 1080,
                height: 1080,
                pages: [{ id: 'p1', background: '#ffffff', children: [] }],
              },
            },
            groupMembers: [],
          },
        }),
      })
    );
    await openPosts(page);
    await page.getByRole('button', { name: 'Open Weekday promo' }).click();
    await expect(page).toHaveURL(new RegExp(`item=${ITEM_A}`));
    await expect(page.getByRole('button', { name: 'Back to Posts' })).toBeVisible({
      timeout: 30_000,
    });
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Open Weekday promo' })).toBeVisible({
      timeout: 20_000,
    });
  });

  // fixme: Marketing Studio toolbar moved on 2026-10-30 (ledger PR-133).
  test.fixme('one toolbar menu holds Recent publishes and Recently deleted', async ({ page }) => {
    const captured: Captured[] = [];
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installLibraryMocks(page, [libraryItem(ITEM_A, 'Weekday promo')], captured);
    await page.route('**/functions/v1/publish-to-meta**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            publications: [
              {
                id: 'pub-1',
                platform: 'instagram',
                publishType: 'post',
                status: 'published',
                caption: 'Weekend rates are live',
                metaPostId: 'm1',
                errorMessage: null,
                publishedAt: '2026-10-18T02:00:00Z',
                createdAt: '2026-10-18T02:00:00Z',
              },
            ],
          },
        }),
      })
    );
    await openPosts(page);
    await expect(page.getByRole('button', { name: 'Open Weekday promo' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'History' }).click();
    await page.getByRole('menuitem', { name: 'Recent publishes' }).click();
    await expect(page.getByRole('heading', { name: 'Recent publishes' })).toBeVisible();
    await expect(page.getByText('Weekend rates are live')).toBeVisible();

    await page.getByRole('button', { name: 'Your posts' }).click();
    await page.getByRole('button', { name: 'History' }).click();
    await page.getByRole('menuitem', { name: 'Recently deleted' }).click();
    await expect(page.getByRole('heading', { name: 'Recently deleted' })).toBeVisible();
  });

  test.describe('at 390px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the Library fits the phone width', async ({ page }) => {
      const captured: Captured[] = [];
      await installPropertyTeamRbacMocks(page, 'full_access');
      await installLibraryMocks(page, [libraryItem(ITEM_A, 'Weekday promo')], captured);
      await openPosts(page);
      await expect(page.getByRole('button', { name: 'Open Weekday promo' })).toBeVisible({
        timeout: 20_000,
      });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  });
});
