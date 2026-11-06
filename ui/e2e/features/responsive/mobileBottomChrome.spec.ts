import { expect, test, type Page } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';
import { mockPublicPropertyBody } from '../../shared/mockFixtures';

/**
 * Phone shell chrome gates.
 *
 * 1. The bottom bar is docked and opaque, reaching both screen edges and the
 *    bottom of the viewport. The old floating pill was inset and translucent,
 *    so page content scrolled visibly through the gutters and underneath it.
 * 2. A screen that mounts a `ContextualActionBar` hides the tab bar, so it must
 *    offer a back control instead — otherwise the screen is a dead end in a
 *    standalone PWA, where there is no browser back gesture.
 */

test.use({ viewport: { width: 393, height: 852 } });

async function barBox(page: Page) {
  const bar = page.locator('nav[aria-label="Main"]');
  await expect(bar).toBeVisible({ timeout: 20_000 });
  return { bar, box: await bar.boundingBox() };
}

test.describe('@smoke mobile bottom chrome', () => {
  test('tab bar is docked edge to edge, not an inset pill', async ({ page }) => {
    await page.goto('/properties?view=list');
    const { box } = await barBox(page);

    expect(box).not.toBeNull();
    expect(box!.x, 'bar must start at the left screen edge').toBeLessThanOrEqual(1);
    expect(box!.width, 'bar must span the full viewport width').toBeGreaterThanOrEqual(392);
    expect(
      box!.y + box!.height,
      'bar must reach the bottom of the viewport, leaving no strip for content'
    ).toBeGreaterThanOrEqual(851);
  });

  test('tab bar surface is opaque so content cannot show through', async ({ page }) => {
    await page.goto('/properties?view=list');
    const { bar } = await barBox(page);

    const alpha = await bar.evaluate((el) => {
      const bg = window.getComputedStyle(el).backgroundColor;
      const match = bg.match(/rgba?\(([^)]+)\)/);
      if (!match) return 1;
      const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()));
      return parts.length > 3 ? parts[3] : 1;
    });

    expect(alpha, 'bottom bar background must be fully opaque').toBe(1);
  });

  test('tab labels stay readable and are not truncated', async ({ page }) => {
    await page.goto('/properties?view=list');
    const { bar } = await barBox(page);

    const labels = await bar.locator('span:not([aria-hidden])').evaluateAll((spans) =>
      spans
        .filter((s) => (s.textContent ?? '').trim().length > 0)
        .map((s) => ({
          text: (s.textContent ?? '').trim(),
          fontPx: Number.parseFloat(window.getComputedStyle(s).fontSize),
          clipped: s.scrollWidth > s.clientWidth + 1,
        }))
    );

    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.fontPx, `"${label.text}" font size`).toBeGreaterThanOrEqual(10);
      expect(label.clipped, `"${label.text}" must not be truncated`).toBe(false);
    }
  });

  test('a detail screen with a reserve bar still offers a way back', async ({ page }) => {
    await mockEdgeFunctions(page, [{ name: 'get-public-property', body: mockPublicPropertyBody }]);
    await page.goto('/properties/solea-mactan');
    await expect(page.getByRole('heading', { name: 'Solea Mactan' })).toBeVisible({
      timeout: 20_000,
    });

    // The reserve bar claims the single bottom slot, so the tab bar is gone...
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);

    // ...which makes the header back control the only exit. It must be there.
    const back = page.locator('[data-mobile-back]');
    await expect(back).toBeVisible();

    // Opened as a deep link (no history), back must still land on the parent list.
    await back.click();
    await expect(page).toHaveURL(/\/properties\/?$/, { timeout: 20_000 });
  });
});
