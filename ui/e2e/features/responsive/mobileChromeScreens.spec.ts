import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  orgHubPaths,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

import { mockEdgeFunctions } from '../../shared/interceptEdge';
import { mockPublicPropertiesListBody, mockPublicPropertyBody } from '../../shared/mockFixtures';

/**
 * Mobile shell chrome capture tool (not a CI gate).
 *
 * Captures the phone/tablet header + bottom bar on representative public and
 * dashboard routes so a chrome change can be compared before/after.
 *
 *   PLAYWRIGHT_CAPTURE_SCREENS=1 MOBILE_CHROME_LABEL=before \
 *     bun run playwright test ui/e2e/features/responsive/mobileChromeScreens.spec.ts --project=chromium
 *
 * Output: `ui/e2e/artifacts/mobile-chrome/<label>/<viewport>/<page>-<state>.png`
 *
 * `SAFE_AREA=1` emulates iPhone safe-area insets (47px top / 34px bottom) by
 * overriding the `--safe-top` / `--safe-bottom` tokens. Chromium cannot emulate
 * `env(safe-area-inset-*)`, so this only has an effect once those tokens exist
 * (Phase 1) — on the pre-change code the insets stay 0 and the bottom strip
 * cannot be reproduced headless.
 */

const captureEnabled = process.env.PLAYWRIGHT_CAPTURE_SCREENS === '1';
const label = process.env.MOBILE_CHROME_LABEL ?? 'before';
const emulateSafeArea = process.env.SAFE_AREA === '1';
const outRoot = join('ui', 'e2e', 'artifacts', 'mobile-chrome', label);

const IPHONE = { width: 393, height: 852 } as const;
const TABLET = { width: 768, height: 1024 } as const;

/** Freeze motion + emulate insets so repeat runs are pixel-stable. */
async function stabilize(page: Page) {
  await page.addInitScript(
    ({ safeArea }) => {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
        ${
          safeArea
            ? `:root { --safe-top: 47px !important; --safe-bottom: 34px !important;
                 --safe-left: 0px !important; --safe-right: 0px !important; }`
            : ''
        }
      `;
      const attach = () => document.head?.appendChild(style);
      if (document.head) attach();
      else document.addEventListener('DOMContentLoaded', attach, { once: true });
    },
    { safeArea: emulateSafeArea }
  );
}

/** The element that actually scrolls (dashboard uses an inner `main`). */
async function scrollBy(page: Page, delta: number) {
  await page.evaluate((amount) => {
    // Public pages scroll the document; the dashboard locks it and scrolls an inner `main`.
    const docScrolls = document.documentElement.scrollHeight > window.innerHeight + 1;
    if (docScrolls) {
      window.scrollTo(0, amount);
      return;
    }
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('main, [data-admin-content-scroll], div')
    ).filter((el) => {
      const overflowY = window.getComputedStyle(el).overflowY;
      return (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 1 &&
        el.clientHeight > window.innerHeight * 0.5
      );
    });
    const scrollable = candidates[0];
    if (scrollable) scrollable.scrollTop = amount;
  }, delta);
  await page.waitForTimeout(450);
}

async function shoot(page: Page, viewport: string, name: string, state: string) {
  const dir = join(outRoot, viewport);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}-${state}.png`) });
}

/** Top-of-page + scrolled, so the sticky/pinned chrome is in the record. */
async function captureStates(page: Page, viewport: string, name: string) {
  await page.waitForTimeout(700);
  await shoot(page, viewport, name, '1-top');
  await scrollBy(page, 420);
  await shoot(page, viewport, name, '2-scrolled');
}

type PublicRoute = {
  name: string;
  path: string;
  mocks?: Parameters<typeof mockEdgeFunctions>[1];
  ready: (page: Page) => Promise<unknown>;
};

const PUBLIC_ROUTES: PublicRoute[] = [
  {
    name: 'public-landing',
    path: '/',
    ready: (page) =>
      expect(page.getByRole('heading', { name: /Find your next stay/i })).toBeVisible({
        timeout: 30_000,
      }),
  },
  {
    name: 'public-properties-list',
    path: '/properties?view=list',
    mocks: [{ name: 'list-public-properties', body: mockPublicPropertiesListBody }],
    ready: (page) =>
      expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 30_000 }),
  },
  {
    name: 'public-property-detail',
    path: '/properties/solea-mactan',
    mocks: [{ name: 'get-public-property', body: mockPublicPropertyBody }],
    ready: (page) =>
      expect(page.getByRole('heading', { name: 'Solea Mactan' })).toBeVisible({ timeout: 30_000 }),
  },
  {
    name: 'public-for-hosts',
    path: '/for-hosts',
    ready: (page) =>
      expect(page.getByRole('heading', { name: /Run every stay/i })).toBeVisible({
        timeout: 30_000,
      }),
  },
  {
    name: 'public-parkings',
    path: '/parkings',
    ready: (page) => page.waitForLoadState('networkidle'),
  },
];

const DASHBOARD_ROUTES: { name: string; path: string; heading: RegExp | string }[] = [
  { name: 'dash-property-home', path: teamRbacPaths.dashboard, heading: /Dashboard|Overview/ },
  { name: 'dash-bookings', path: teamRbacPaths.bookings, heading: 'Bookings' },
  { name: 'dash-finance', path: teamRbacPaths.finance, heading: 'Finance' },
  { name: 'dash-settings', path: teamRbacPaths.settings, heading: 'Settings' },
  { name: 'dash-team', path: teamRbacPaths.team, heading: 'Team' },
  { name: 'dash-activity', path: teamRbacPaths.activity, heading: 'Activity' },
  { name: 'dash-public-pages', path: teamRbacPaths.publicPages, heading: /Public pages/i },
];

test.describe('mobile chrome capture', () => {
  test.skip(!captureEnabled, 'Set PLAYWRIGHT_CAPTURE_SCREENS=1 to capture');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  for (const [viewportName, viewport] of [
    ['iphone', IPHONE],
    ['tablet', TABLET],
  ] as const) {
    test.describe(viewportName, () => {
      test.use({ viewport });

      for (const route of PUBLIC_ROUTES) {
        test(`${route.name}`, async ({ page }) => {
          await stabilize(page);
          if (route.mocks) await mockEdgeFunctions(page, route.mocks);
          await page.goto(route.path);
          await route.ready(page).catch(() => undefined);
          await captureStates(page, viewportName, route.name);
        });
      }

      for (const route of DASHBOARD_ROUTES) {
        test(`${route.name}`, async ({ page }) => {
          await stabilize(page);
          await installPropertyTeamRbacMocks(page, 'full_access', { assistantEnabled: true });
          await page.goto(route.path);
          // Best effort: a missing/duplicate heading must not abort the capture run.
          try {
            await expect(
              page.getByRole('heading', { name: route.heading, level: 1 }).first()
            ).toBeVisible({ timeout: 30_000 });
          } catch {
            await page.waitForLoadState('networkidle').catch(() => undefined);
          }
          await captureStates(page, viewportName, route.name);
        });
      }

      test('dash-org-home', async ({ page }) => {
        await stabilize(page);
        await installPropertyTeamRbacMocks(page, 'full_access', {
          orgHub: true,
          multiProperty: true,
          assistantEnabled: true,
        });
        await page.goto(orgHubPaths.dashboard);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await captureStates(page, viewportName, 'dash-org-home');
      });
    });
  }
});
