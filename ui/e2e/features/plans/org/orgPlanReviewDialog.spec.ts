import { expect, test, type Page } from '@playwright/test';

import {
  ONE_PROPERTY_MONTHLY_TOTAL,
  REMOVES,
  TIER_ORDER,
  TIER_TITLES,
  UNLOCKS,
  type TierCode,
} from '../../../../src/features/dashboard/plans/lib/planTierExpectations';
import { goldenPlanId } from '../../../../src/features/dashboard/plans/lib/planTierGolden';
import { installPlansCheckoutMocks, plansE2ePaths } from '../shared/orgPlanCheckoutHarness';
import { bringTierCardIntoView, retryThroughDevReload } from '../shared/planPageAssertions';

const subscriptionFor = (code: TierCode) => (code === 'free' ? null : goldenPlanId(code));

async function openReview(page: Page, current: TierCode, target: TierCode, verb: string) {
  await installPlansCheckoutMocks(page, { subscriptionPlanId: subscriptionFor(current) });
  await retryThroughDevReload(async () => {
    await page.goto(plansE2ePaths.orgPlans('plans'));
    await expect(page.getByRole('region', { name: 'Subscription plans' })).toBeVisible();
    const card = await bringTierCardIntoView(page, target);
    await card.getByRole('button', { name: `${verb} to ${TIER_TITLES[target]}` }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
  return page.getByRole('dialog');
}

const list = (dialog: ReturnType<Page['getByRole']>, heading: 'Unlocks' | 'Removes') =>
  dialog.locator(`p:text-is("${heading}") + ul > li`);

test.describe('@ci org plan review dialog, per transition', () => {
  // First hit on a route compiles it in the Vite dev server; parallel workers make that slow.
  test.setTimeout(75_000);

  const upgrades = TIER_ORDER.slice(0, -1).map((from, i) => [from, TIER_ORDER[i + 1]] as const);

  for (const [from, to] of upgrades) {
    if (to === 'managed') continue; // Managed is sales-assisted: covered in orgPlansCardsCompare.
    test(`upgrade ${TIER_TITLES[from]} to ${TIER_TITLES[to]} lists exactly what it unlocks`, async ({
      page,
    }) => {
      const dialog = await openReview(page, from, to, 'Upgrade');
      await expect(
        dialog.getByRole('heading', { name: `Upgrade to ${TIER_TITLES[to]}` })
      ).toBeVisible();
      await expect(list(dialog, 'Unlocks')).toHaveText(UNLOCKS[`${from}>${to}`]);
      await expect(dialog.getByText('Removes', { exact: true })).toHaveCount(0);
      await expect(dialog.locator('[aria-live="polite"]')).toContainText(
        `${ONE_PROPERTY_MONTHLY_TOTAL[to]}/month`
      );
      await expect(dialog.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
      await expect(dialog.getByRole('button', { name: 'Confirm downgrade' })).toHaveCount(0);
    });
  }

  test('skipping tiers (Free to Business) unlocks everything Business has that Free lacks', async ({
    page,
  }) => {
    const dialog = await openReview(page, 'free', 'pro', 'Upgrade');
    const shown = await list(dialog, 'Unlocks').allInnerTexts();
    const expected = new Set([
      ...UNLOCKS['free>starter'],
      ...UNLOCKS['starter>growth'],
      ...UNLOCKS['growth>pro'],
    ]);
    // Team seats, AI credits and search placement upgrade in place: only the final value is listed.
    const rolled = [
      'Up to 3 team members',
      'Up to 5 team members',
      '5,000 AI credits per month',
      'Top 30 search placement',
    ];
    for (const label of rolled) expected.delete(label);
    expect([...shown].sort()).toEqual([...expected].sort());
    await expect(dialog.locator('[aria-live="polite"]')).toContainText(
      `${ONE_PROPERTY_MONTHLY_TOTAL.pro}/month`
    );
  });

  const downgrades: Array<[TierCode, TierCode]> = [
    ['starter', 'free'],
    ['growth', 'starter'],
    ['pro', 'growth'],
  ];
  for (const [from, to] of downgrades) {
    test(`downgrade ${TIER_TITLES[from]} to ${TIER_TITLES[to]} lists exactly what it removes`, async ({
      page,
    }) => {
      const dialog = await openReview(page, from, to, 'Downgrade');
      await expect(
        dialog.getByRole('heading', { name: `Move to ${TIER_TITLES[to]}` })
      ).toBeVisible();
      await expect(list(dialog, 'Removes')).toHaveText(REMOVES[`${from}>${to}`]);
      await expect(dialog.getByText('Unlocks', { exact: true })).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0);
      const confirm = dialog.getByRole('button', { name: 'Confirm downgrade' });
      if (to === 'free') {
        await expect(confirm).toBeDisabled();
        await dialog.getByRole('checkbox').click();
      }
      await expect(confirm).toBeEnabled();
    });
  }

  test('Business to Free lists every paid capability it removes', async ({ page }) => {
    const dialog = await openReview(page, 'pro', 'free', 'Downgrade');
    await expect(list(dialog, 'Removes')).toHaveText(REMOVES['pro>free']);
  });
});
