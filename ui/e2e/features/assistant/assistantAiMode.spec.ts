/**
 * AI chat mode vs Advanced mode (docs/workflow/in-progress/ai-chat-mode.md §5).
 * Mocked edge functions via the property-team RBAC harness; no live model calls.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  mockedAssistantMemory,
  mockedSavedDashboardMode,
  openAdminMoreSheet,
  openPropertyDashboard,
  queueAssistantChatBlocksForMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_SLUG,
} from '../team/shared/propertyTeamRbacHarness';

const PROPERTY_ROOT = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`;

function modeRadio(page: Page, label: 'AI' | 'Advanced') {
  return page
    .getByRole('radiogroup', { name: 'Dashboard mode' })
    .first()
    .getByRole('radio', { name: label });
}

function composer(page: Page) {
  return page.getByRole('textbox', { name: 'Message' });
}

function canvas(page: Page) {
  return page.locator('[data-assistant-canvas="open"]');
}

async function enterAiMode(page: Page) {
  await modeRadio(page, 'AI').click();
  await expect(composer(page)).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(() => {
  queueAssistantChatBlocksForMocks([{ type: 'text', text: 'Two bookings need your review.' }]);
});

test.describe('@ci AI mode', () => {
  test('@smoke toggles Advanced to AI and back, keeping the page in the canvas', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeVisible({
      timeout: 20_000,
    });

    await enterAiMode(page);
    await expect(canvas(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PROPERTY_ROOT}/bookings`));
    // Sheet launcher is hidden in AI mode; the chat is the full page.
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toHaveCount(0);
    await expect.poll(() => mockedSavedDashboardMode()).toBe('ai');

    await modeRadio(page, 'Advanced').click();
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(new RegExp(`${PROPERTY_ROOT}/bookings`));
    await expect.poll(() => mockedSavedDashboardMode()).toBe('advanced');
  });

  test('keeps AI mode after a reload (server preference + local cache)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await enterAiMode(page);
    await page.reload();
    await expect(composer(page)).toBeVisible({ timeout: 20_000 });
    await expect(modeRadio(page, 'AI')).toHaveAttribute('aria-checked', 'true');
  });

  test('?mode=ai opens AI mode and the param is removed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await page.goto(`${PROPERTY_ROOT}/bookings?mode=ai`);
    await expect(composer(page)).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/mode=ai/);
  });

  test('closing the canvas shows the briefing; Show page reopens it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await enterAiMode(page);

    await page.getByRole('button', { name: 'Close page' }).click();
    await expect(page).toHaveURL(/canvas=off/);
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.getByTestId('assistant-briefing')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pending review/ })).toBeVisible();
    await expect(page).toHaveTitle(/Assistant/);

    await page.getByRole('button', { name: 'Show page' }).click();
    await expect(page).not.toHaveURL(/canvas=off/);
    await expect(canvas(page)).toBeVisible();
  });

  test('the conversation continues across a mode switch', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await enterAiMode(page);

    await composer(page).fill('Which bookings need review?');
    await composer(page).press('Enter');
    await expect(page.getByText('Two bookings need your review.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/chat=conv-e2e-assistant-001/);

    // Draft survives the switch too.
    await composer(page).fill('and tomorrow?');
    await modeRadio(page, 'Advanced').click();
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('Two bookings need your review.')).toBeVisible();
    await expect(sheet.getByRole('textbox', { name: 'Message' })).toHaveValue('and tomorrow?');
  });

  test('an Open handoff loads the screen in the canvas and feedback is saved', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    queueAssistantChatBlocksForMocks([
      { type: 'text', text: 'Payment settings live on the Settings page.' },
      {
        type: 'open_page',
        routeKey: 'property.settings',
        label: 'Open payment settings',
        href: `${PROPERTY_ROOT}/settings`,
      },
    ]);
    await openPropertyDashboard(page);
    await enterAiMode(page);
    await composer(page).fill('Where do I change payment methods?');
    await composer(page).press('Enter');

    await expect(page.getByText('Open payment settings')).toBeVisible({ timeout: 15_000 });
    const feedback = page.waitForRequest(
      (req) => req.url().includes('dashboard-assistant-feedback') && req.method() === 'POST'
    );
    await page.getByRole('button', { name: 'Good response' }).click();
    expect((await feedback).postDataJSON()).toMatchObject({
      messageId: 'msg-e2e-assistant-1',
      rating: 1,
    });
    await expect(page.getByRole('button', { name: 'Good response' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`${PROPERTY_ROOT}/settings\\?chat=conv-e2e-assistant-001`)
    );
    await expect(canvas(page)).toBeVisible();
  });

  test('slash commands send prompts and @mentions pin context', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await enterAiMode(page);

    // @mention: pick the property from the inline list; the token leaves the text.
    await composer(page).fill('How is @sol');
    const mentions = page.getByRole('listbox', { name: 'Mention' });
    await expect(mentions.getByRole('option', { name: /Solea Mactan/ })).toBeVisible({
      timeout: 15_000,
    });
    await composer(page).press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Solea Mactan' })).toBeVisible();
    await expect(composer(page)).toHaveValue('How is ');

    // Slash: `/rev` + Enter sends the review prompt (with the pin) and clears the box.
    await composer(page).fill('/rev');
    const commands = page.getByRole('listbox', { name: 'Commands' });
    await expect(commands.getByRole('option', { name: /\/review/ })).toBeVisible();
    const chat = page.waitForRequest(
      (req) => req.url().includes('dashboard-assistant-chat') && req.method() === 'POST'
    );
    await composer(page).press('Enter');
    const body = (await chat).postDataJSON() as {
      message: string;
      attachedContext?: Array<{ label: string }>;
    };
    expect(body.message).toContain('waiting for my review');
    expect(body.attachedContext?.map((item) => item.label)).toEqual(['Solea Mactan']);
    await expect(composer(page)).toHaveValue('');

    // Esc hides the menu without clearing the text.
    await composer(page).fill('/');
    await expect(commands).toBeVisible();
    await composer(page).press('Escape');
    await expect(commands).toHaveCount(0);
    await expect(composer(page)).toHaveValue('/');
  });

  test('/memory opens the memory list; saved and removed items round-trip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await enterAiMode(page);

    await composer(page).fill('/mem');
    await composer(page).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Memory' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'New preference' }).fill('Show amounts in pesos');
    await dialog.getByRole('textbox', { name: 'New preference' }).press('Enter');
    await expect(dialog.getByText('Show amounts in pesos')).toBeVisible();
    expect(mockedAssistantMemory().map((m) => m.content)).toEqual(['Show amounts in pesos']);

    await dialog.getByRole('button', { name: 'Forget "Show amounts in pesos"' }).click();
    await expect(dialog.getByText('Nothing saved yet')).toBeVisible();

    // An unsaved draft asks before closing.
    await dialog.getByRole('textbox', { name: 'New house style rule' }).fill('Sign as the team');
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });

  test('a medium-width canvas collapses wide page grids to two columns', async ({ page }) => {
    // 1280px viewport → default canvas 704px → data-canvas-size="medium".
    await page.setViewportSize({ width: 1280, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await enterAiMode(page);
    await expect(canvas(page)).toHaveAttribute('data-canvas-size', 'medium');
    const columns = await canvas(page).evaluate((pane) =>
      ['grid lg:grid-cols-4', 'grid lg:grid-cols-[minmax(0,1fr)_340px]'].map((className) => {
        const grid = document.createElement('div');
        grid.className = className;
        pane.appendChild(grid);
        const count = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        grid.remove();
        return count;
      })
    );
    // Four stat cards → two columns; a main + sidebar template stacks.
    expect(columns).toEqual([2, 1]);
  });

  test('small laptop: the rail collapses so the canvas keeps its minimum width', async ({
    page,
  }) => {
    // A width saved on a bigger screen (or before the 560px floor) is raised, not honored.
    await page.addInitScript(() => window.localStorage.setItem('kame-ai-canvas-width', '420'));
    await page.setViewportSize({ width: 1024, height: 800 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await enterAiMode(page);
    await expect(canvas(page)).toHaveAttribute('data-canvas-size', 'medium');
    const rail = page.getByRole('complementary', { name: 'Assistant' });
    await expect(rail.getByRole('button', { name: 'Expand sidebar' })).toHaveCount(0);
    await expect.poll(async () => (await rail.boundingBox())?.width).toBe(64);
    const canvasWidth = (await canvas(page).boundingBox())!.width;
    expect(canvasWidth).toBeGreaterThanOrEqual(560);
    await expect(composer(page)).toBeVisible();
    const composerWidth = (await composer(page).boundingBox())!.width;
    expect(composerWidth).toBeGreaterThan(280);

    // Closing the page gives the rail its room back.
    await page.getByRole('button', { name: 'Close page' }).click();
    await expect.poll(async () => (await rail.boundingBox())?.width).toBe(264);
    await expect(rail.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();

    // Section-nav pages (Settings, Templates) drop the side nav so forms keep their width.
    await page.goto(`${PROPERTY_ROOT}/settings`);
    await expect(canvas(page).getByRole('heading', { name: 'Settings' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(canvas(page).locator('[data-section-nav-aside]')).toBeHidden();
    await expect.poll(async () => (await rail.boundingBox())?.width).toBe(64);
  });

  test('phone: chat first, single bottom layer, page opens full screen with Back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: true,
    });
    await openPropertyDashboard(page);
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();

    // Pages with their own phone hero hide the fallback top bar, so the toggle lives in More.
    await openAdminMoreSheet(page);
    await page
      .getByRole('radiogroup', { name: 'Dashboard mode' })
      .filter({ visible: true })
      .getByRole('radio', { name: 'AI' })
      .click();
    await expect(composer(page)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/canvas=off/);
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
    await expect(page.getByTestId('assistant-briefing')).toBeVisible();
    await page.goto(`${PROPERTY_ROOT}/finance?chat=conv-e2e-assistant-001`);
    await expect(canvas(page)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Back to chat' }).click();
    await expect(page).toHaveURL(/canvas=off/);
    await expect(composer(page)).toBeVisible();
  });

  test('plan-blocked hosts see a locked toggle that opens the upgrade modal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: false,
      aiModeEnabled: true,
      freePlan: true,
    });
    await openPropertyDashboard(page);
    const aiRadio = modeRadio(page, 'AI');
    await expect(aiRadio).toBeVisible({ timeout: 20_000 });
    await expect(aiRadio.getByLabel('Upgrade')).toBeVisible();
    await aiRadio.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(modeRadio(page, 'Advanced')).toHaveAttribute('aria-checked', 'true');
    expect(mockedSavedDashboardMode()).toBe('advanced');
  });

  test('toggle is hidden when AI mode is off for the platform', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installPropertyTeamRbacMocks(page, 'full_access', {
      assistantEnabled: true,
      aiModeEnabled: false,
      savedDashboardMode: 'ai',
    });
    await openPropertyDashboard(page);
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('radiogroup', { name: 'Dashboard mode' })).toHaveCount(0);
  });
});
