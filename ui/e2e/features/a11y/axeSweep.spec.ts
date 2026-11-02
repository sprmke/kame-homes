import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { installPropertyTeamRbacMocks, orgHubPaths, teamRbacPaths } from '../team/shared/propertyTeamRbacHarness';

/**
 * Accessibility sweep (production-readiness checklist 33).
 *
 * Exit gate: zero serious/critical axe violations on the baseline routes. Everything is
 * mocked, so this runs in CI without a backend. Tag @ci so CD Dev keeps the gate.
 */

const OWNER = '/org/kame-homes-ph/property/solea-mactan';

const PUBLIC_PATHS = [
  '/',
  '/properties',
  '/parkings',
  '/developments',
  '/search',
  '/for-hosts',
  '/for-hosts/pricing',
  '/for-guests/login',
  '/for-hosts/login',
  '/about',
  '/contact',
  '/support',
  '/privacy',
  '/terms',
];

const PROPERTY_PATHS = [
  teamRbacPaths.dashboard,
  teamRbacPaths.bookings,
  teamRbacPaths.finance,
  teamRbacPaths.marketing,
  teamRbacPaths.reviews,
  teamRbacPaths.settings,
  teamRbacPaths.team,
  teamRbacPaths.publicPages,
  teamRbacPaths.activity,
  `${OWNER}/pricing`,
  `${OWNER}/maintenance`,
  `${OWNER}/inbox`,
  `${OWNER}/notifications`,
  `${OWNER}/templates`,
  `${OWNER}/analytics`,
  `${OWNER}/help-support`,
  `${OWNER}/plans`,
];

const ORG_PATHS = [orgHubPaths.dashboard, orgHubPaths.bookings, orgHubPaths.properties, orgHubPaths.team, orgHubPaths.reviews];

const GUEST_PATHS = ['/properties/solea-mactan', '/properties/solea-mactan/form'];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SERIOUS = new Set(['serious', 'critical']);

function formatViolations(url: string, violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations
    .filter((violation) => SERIOUS.has(violation.impact ?? ''))
    .map(
      (violation) =>
        `${url} -> [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join(', ')})`
    );
}

async function audit(page: Page, paths: string[]) {
  const problems: string[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState('load');
    await expect(page.locator('#root')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.fonts?.ready);
    // In-view reveals keep below-the-fold cards at opacity 0; walk the page so every
    // reveal fires before axe reads computed colours.
    await page.evaluate(async () => {
      const step = Math.max(window.innerHeight * 0.8, 400);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      window.scrollTo(0, 0);
    });
    // Entrance animations stagger card opacity; axe would read transient colours.
    await page.waitForFunction(
      () => document.getAnimations().every((animation) => animation.playState !== 'running'),
      undefined,
      { timeout: 8000 }
    ).catch(() => undefined);
    await page.waitForTimeout(400);
    let results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    let found = formatViolations(path, results.violations);
    if (found.length) {
      // Loading placeholders can briefly render unnamed controls; only persistent
      // violations should fail the gate.
      await page.waitForTimeout(1500);
      results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      found = formatViolations(path, results.violations);
    }
    problems.push(...found);
  }
  return problems;
}

test.describe('@ci accessibility sweep', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('public routes have no serious or critical axe violations', async ({ page }) => {
    const problems = await audit(page, PUBLIC_PATHS);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('guest booking routes have no serious or critical axe violations', async ({ page }) => {
    const problems = await audit(page, GUEST_PATHS);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('property dashboard routes have no serious or critical axe violations', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    const problems = await audit(page, PROPERTY_PATHS);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('org hub routes have no serious or critical axe violations', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true });
    const problems = await audit(page, ORG_PATHS);
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
