import { expect, test } from '@playwright/test';

/**
 * Mobile responsive gate (rebrand U-11, mobile-native UI rule).
 *
 * The rename changed the wordmark from "Kame Homes" to the shorter "Kame Space",
 * so the layout risk is text width in the shell, cards and nav. This locks the
 * phone and tablet widths: no route may scroll sideways.
 *
 * 1px tolerance covers sub-pixel rounding in scrollbar math.
 */

const ROUTES = [
  '/',
  '/for-hosts',
  '/privacy',
  '/terms',
  '/support',
  '/contact',
  '/properties',
  '/parkings',
  '/developments',
  '/search',
];

const VIEWPORTS = [
  { width: 375, height: 812, label: 'phone' },
  { width: 768, height: 1024, label: 'tablet' },
];

for (const viewport of VIEWPORTS) {
  test.describe(`no horizontal overflow — ${viewport.label} ${viewport.width}px @smoke`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route}`, async ({ page }) => {
        await page.goto(route);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );

        expect(overflow, `${route} overflows ${overflow}px at ${viewport.width}px`).toBeLessThanOrEqual(
          1
        );
      });
    }
  });
}
