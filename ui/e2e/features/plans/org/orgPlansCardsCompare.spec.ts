import { expect, test, type Page } from '@playwright/test';

import {
  CARD_EXPECTATIONS,
  compareTargetForBullet,
  TIER_ORDER,
  TIER_TITLES,
  type TierCode,
} from '../../../../src/features/dashboard/plans/lib/planTierExpectations';
import { goldenPlanId } from '../../../../src/features/dashboard/plans/lib/planTierGolden';
import { installPlansCheckoutMocks, plansE2ePaths } from '../shared/orgPlanCheckoutHarness';
import {
  expectCompareTable,
  expectTierCards,
  readCompareTable,
  retryThroughDevReload,
  tierCard,
} from '../shared/planPageAssertions';

async function openTab(page: Page, tab: 'plans' | 'compare') {
  await retryThroughDevReload(async () => {
    await openTabOnce(page, tab);
  });
}

async function openTabOnce(page: Page, tab: 'plans' | 'compare') {
  await page.goto(plansE2ePaths.orgPlans(tab));
  await expect(page.getByRole('heading', { name: 'Plans & Billing' }).first()).toBeVisible({
    timeout: 25_000,
  });
  if (tab === 'plans') {
    await expect(page.getByRole('region', { name: 'Subscription plans' })).toBeVisible();
  } else {
    await expect(page.locator('table th[scope="col"]').first()).toBeVisible({ timeout: 15_000 });
  }
}

/** Free is "no subscription"; every other tier is a live subscription to that plan. */
function subscriptionFor(code: TierCode): string | null {
  return code === 'free' ? null : goldenPlanId(code);
}

function expectedAction(current: TierCode, target: TierCode): string {
  const title = TIER_TITLES[target];
  if (target === current) return `${title} is your current plan`;
  if (target === 'managed') return `Contact sales to ${title}`;
  const direction =
    TIER_ORDER.indexOf(target) > TIER_ORDER.indexOf(current) ? 'Upgrade' : 'Downgrade';
  return `${direction} to ${title}`;
}

test.describe('@ci org Plans page, per current tier', () => {
  // First hit on a route compiles it in the Vite dev server; parallel workers make that slow.
  test.setTimeout(75_000);

  for (const current of TIER_ORDER) {
    test(`on ${TIER_TITLES[current]}: cards, current marker and actions`, async ({ page }) => {
      await installPlansCheckoutMocks(page, { subscriptionPlanId: subscriptionFor(current) });
      await openTab(page, 'plans');

      await expectTierCards(page);

      for (const code of TIER_ORDER) {
        const card = tierCard(page, code);
        if (code === current) {
          await expect(card).toHaveAttribute('aria-current', 'true');
          await expect(card.getByText('Current', { exact: true })).toBeVisible();
        } else {
          await expect(card).not.toHaveAttribute('aria-current', 'true');
          await expect(card.getByText('Current', { exact: true })).toHaveCount(0);
        }
        await expect(card.getByRole('button')).toHaveAttribute(
          'aria-label',
          expectedAction(current, code)
        );
      }
    });

    test(`on ${TIER_TITLES[current]}: Compare table matches the documented matrix`, async ({
      page,
    }) => {
      await installPlansCheckoutMocks(page, { subscriptionPlanId: subscriptionFor(current) });
      await openTab(page, 'compare');

      await expectCompareTable(page, { currentTier: current });
      const rendered = await readCompareTable(page);
      expect(rendered.actions).toEqual(TIER_ORDER.map((code) => expectedAction(current, code)));
    });
  }

  test('every card bullet is backed by a Compare cell on the same tier', async ({ page }) => {
    await installPlansCheckoutMocks(page, { subscriptionPlanId: null });
    await openTab(page, 'plans');
    const bulletsByTier: Record<string, string[]> = {};
    for (const code of TIER_ORDER) {
      bulletsByTier[code] = await tierCard(page, code).locator('ul > li').allInnerTexts();
      expect(bulletsByTier[code]).toEqual(CARD_EXPECTATIONS[code].bullets);
    }

    await page.getByRole('tab', { name: 'Compare' }).click();
    await expect(page.locator('table th[scope="col"]').first()).toBeVisible();
    const rendered = await readCompareTable(page);
    const rows = new Map(rendered.groups.flatMap((g) => g.rows).map((r) => [r.label, r.cells]));

    const problems: string[] = [];
    TIER_ORDER.forEach((code, index) => {
      for (const bullet of bulletsByTier[code]) {
        const target = compareTargetForBullet(bullet, index);
        if (!target) continue;
        const cell = rows.get(target.rowLabel)?.[index];
        if (cell === undefined || !target.expected(cell)) {
          problems.push(`${code}: "${bullet}" vs Compare "${target.rowLabel}" = ${cell}`);
        }
      }
    });
    expect(problems).toEqual([]);
  });

  test('Managed customers are told to contact support instead of self-serve downgrade', async ({
    page,
  }) => {
    await installPlansCheckoutMocks(page, { subscriptionPlanId: goldenPlanId('managed') });
    await openTab(page, 'plans');
    await tierCard(page, 'pro').getByRole('button', { name: 'Downgrade to Business' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Contact support to change your Managed plan.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm downgrade' })).toBeDisabled();
  });

  test('tabs switch between Plans, Compare and FAQs with the right section title', async ({
    page,
  }) => {
    await installPlansCheckoutMocks(page, { subscriptionPlanId: goldenPlanId('starter') });
    await openTab(page, 'plans');
    await expect(page.getByRole('heading', { name: 'Choose your plan' })).toBeVisible();
    await page.getByRole('tab', { name: 'Compare' }).click();
    await expect(page.getByRole('heading', { name: 'Compare features' })).toBeVisible();
    await page.getByRole('tab', { name: 'FAQs' }).click();
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
  });
});
