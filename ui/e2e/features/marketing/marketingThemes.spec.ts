import { expect, test, type Page, type Route } from '@playwright/test';

import { expectNoPageHorizontalOverflow } from '../../shared/layoutAssertions';
import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Marketing themes: first visit lands on the theme picker, a theme opens the
 * workspace, the switcher moves between themes, and saved themes CRUD through
 * `marketing-themes`. Mocked edge; no real backend.
 */

type ThemeRow = {
  id: string;
  name: string;
  tokens: Record<string, unknown>;
  source: string;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

const OCEAN_TOKENS = {
  version: 1,
  palette: {
    primary: '#2a9d8f',
    secondary: '#dff3ef',
    accent: '#e76f51',
    surface: '#f7fbfa',
    ink: '#16324a',
  },
  fonts: { display: 'Playfair Display', body: 'Lora', label: 'Montserrat' },
  background: 'solid',
  corners: 'soft',
};

async function installThemesMock(page: Page, initial: ThemeRow[] = []) {
  const state = { themes: [...initial], requests: [] as Array<{ method: string; body: unknown }> };
  await page.route('**/functions/v1/marketing-themes**', async (route: Route) => {
    const method = route.request().method();
    const body = route.request().postDataJSON?.() ?? null;
    state.requests.push({ method, body });
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status < 400 ? { success: true, data } : data),
      });
    if (method === 'GET') return reply({ themes: state.themes, itemCounts: {} });
    if (method === 'POST') {
      const row: ThemeRow = {
        id: `00000000-0000-4000-8000-${String(state.themes.length + 1).padStart(12, '0')}`,
        name: body.name,
        tokens: body.tokens,
        source: body.source,
        sourceRef: body.sourceRef ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.themes.push(row);
      return reply(row);
    }
    if (method === 'PATCH') {
      const row = state.themes.find((t) => t.id === body.id)!;
      Object.assign(row, body);
      return reply(row);
    }
    if (method === 'DELETE') {
      state.themes = state.themes.filter((t) => t.id !== body.id);
      return reply({ deleted: true, id: body.id, movedItems: 0 });
    }
    return route.continue();
  });
  return state;
}

test.describe('@ci marketing themes', () => {
  test('first visit shows the theme picker, then opens the workspace', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installThemesMock(page);
    await page.goto(teamRbacPaths.marketing);

    await expect(page.getByRole('heading', { name: 'Themes', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Starter looks' })).toBeVisible();
    await page.screenshot({ path: 'test-results/marketing-themes-home.png', fullPage: false });

    await page.getByRole('button', { name: 'Open Property colors' }).click();
    await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Posts' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Videos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /AI Studio/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Theme: Property colors/ })).toBeVisible();
    await page.screenshot({ path: 'test-results/marketing-themes-workspace.png', fullPage: false });

    // Reload: lands back in the last theme, not the picker.
    await page.reload();
    await expect(page.getByRole('button', { name: /Theme: Property colors/ })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('switches to a starter look and back to all themes', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installThemesMock(page);
    await page.goto(teamRbacPaths.marketing);

    await page.getByRole('button', { name: 'Open Garden Bloom' }).click({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Theme: Garden Bloom/ })).toBeVisible();
    await expect(page).toHaveURL(/theme=starter%3Agarden-glow|theme=starter:garden-glow/);

    await page.getByRole('button', { name: /Theme: Garden Bloom/ }).click();
    await page.getByRole('menuitem', { name: 'All themes' }).click();
    await expect(page.getByRole('heading', { name: 'Themes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back to Garden Bloom/ })).toBeVisible();
  });

  test('creates a theme, edits it, and deletes it', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    const state = await installThemesMock(page);
    await page.goto(teamRbacPaths.marketing);

    await page.getByRole('button', { name: 'New theme' }).click({ timeout: 20_000 });
    const dialog = page.getByRole('dialog', { name: 'New theme' });
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: 'test-results/marketing-themes-editor.png', fullPage: false });
    await dialog.getByLabel('Name').fill('Summer');
    await dialog.getByRole('radio', { name: /Magazine/ }).click();
    await dialog.getByRole('button', { name: 'Save theme' }).click();

    await expect(page.getByRole('button', { name: /Theme: Summer/ })).toBeVisible();
    const created = state.requests.find((r) => r.method === 'POST')!.body as {
      name: string;
      tokens: { fonts: { display: string } };
    };
    expect(created.name).toBe('Summer');
    expect(created.tokens.fonts.display).toBe('Instrument Serif');

    await page.getByRole('button', { name: /Theme: Summer/ }).click();
    await page.getByRole('menuitem', { name: 'Edit theme' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit theme' });
    await edit.getByLabel('Name').fill('Summer 2026');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: /Theme: Summer 2026/ })).toBeVisible();

    await page.getByRole('button', { name: /Theme: Summer 2026/ }).click();
    await page.getByRole('menuitem', { name: 'All themes' }).click();
    await page.getByRole('button', { name: 'Summer 2026 options' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Summer 2026' })).toHaveCount(0);
  });

  test('calendar opens in the theme: starter look picks its own layout, Advanced toggles', async ({
    page,
  }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installThemesMock(page);
    await page.goto(`${teamRbacPaths.marketing}?theme=starter:garden-glow`);

    await expect(page.getByRole('button', { name: /Theme: Garden Bloom/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Show on calendar/ })).toBeVisible();
    await expect(page.getByText('Botanical', { exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/marketing-themes-calendar.png', fullPage: false });

    await page.getByRole('button', { name: 'Advanced' }).click();
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: /Show on calendar/ }).click();
    await expect(page.getByRole('switch').first()).toBeVisible();
  });

  test('a saved theme from the server shows in the switcher', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await installThemesMock(page, [
      {
        id: '00000000-0000-4000-8000-0000000000aa',
        name: 'Ocean',
        tokens: OCEAN_TOKENS,
        source: 'custom',
        sourceRef: null,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ]);
    await page.goto(teamRbacPaths.marketing);
    await page.getByRole('button', { name: 'Open Ocean' }).click({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Theme: Ocean/ })).toBeVisible();
  });

  test.describe('at 375px', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('themes home, switcher sheet and editor fit the phone with no sideways scroll', async ({
      page,
    }) => {
      await installPropertyTeamRbacMocks(page, 'full_access');
      await installThemesMock(page);
      await page.goto(teamRbacPaths.marketing);

      await expect(page.getByRole('heading', { name: 'Themes', exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expectNoPageHorizontalOverflow(page);
      await page.screenshot({ path: 'test-results/marketing-themes-home-375.png' });

      await page.getByRole('button', { name: 'Open Bubble Pop' }).click();
      const switcher = page.getByRole('button', { name: /Theme: Bubble Pop/ });
      await expect(switcher).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
      await page.screenshot({ path: 'test-results/marketing-themes-workspace-375.png' });

      await switcher.click();
      const sheet = page.getByRole('dialog', { name: 'Themes' });
      await expect(sheet).toBeVisible();
      await page.screenshot({ path: 'test-results/marketing-themes-switcher-375.png' });
      await sheet.getByRole('button', { name: 'Customize theme' }).click();
      await expect(page.getByRole('dialog', { name: 'Customize Bubble Pop' })).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
      await page.screenshot({ path: 'test-results/marketing-themes-editor-375.png' });
    });
  });
});
