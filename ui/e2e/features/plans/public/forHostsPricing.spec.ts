import { expect, test, type Page } from '@playwright/test';

import { expectNoPageHorizontalOverflow } from '../../../shared/layoutAssertions';
import { fulfillJson, PLANS_E2E_CATALOG } from '../shared/orgPlanHarnessShared';
import {
  compareTable,
  expectCompareTable,
  expectTierCards,
  retryThroughDevReload,
  tierCard,
} from '../shared/planPageAssertions';

async function mockPublicPricing(page: Page, options: { fail?: boolean } = {}) {
  await page.route('**/functions/v1/list-public-pricing-plans*', async (route) => {
    if (options.fail) {
      await fulfillJson(route, { success: false, error: 'boom' }, 500);
      return;
    }
    await fulfillJson(route, { success: true, data: { plans: PLANS_E2E_CATALOG } });
  });
}

async function openPricing(page: Page) {
  await retryThroughDevReload(async () => {
    await page.goto('/for-hosts/pricing');
    await expect(page.getByRole('heading', { name: 'Plans that grow with you' })).toBeVisible();
  });
}

test.describe('@ci for-hosts pricing page', () => {
  // First hit on a route compiles it in the Vite dev server; parallel workers make that slow.
  test.setTimeout(75_000);

  test('cards show every tier with its documented price, badge, pitch and bullets', async ({
    page,
  }) => {
    await mockPublicPricing(page);
    await openPricing(page);
    await expectTierCards(page);
  });

  test('compare table matches the documented tier matrix', async ({ page }) => {
    await mockPublicPricing(page);
    await openPricing(page);
    await expect(
      page.getByRole('heading', { name: 'Compare features', exact: true })
    ).toBeVisible();
    await expectCompareTable(page, { currentTier: null });
  });

  test('cards come in ladder order: Free, Starter, Pro, Business, Managed', async ({ page }) => {
    await mockPublicPricing(page);
    await openPricing(page);
    const codes = await page
      .locator('article[aria-labelledby^="plan-tier-"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('aria-labelledby')?.replace('plan-tier-', ''))
      );
    expect(codes).toEqual(['free', 'starter', 'growth', 'pro', 'managed']);
  });

  test('retired Business Plus and Commission never appear', async ({ page }) => {
    await mockPublicPricing(page);
    await openPricing(page);
    await expect(page.getByText(/Business Plus/i)).toHaveCount(0);
    await expect(page.getByText(/8% fee/i)).toHaveCount(0);
    await expect(tierCard(page, 'free')).toHaveCount(1);
  });

  test('paid and Free CTAs go to host login, signed out', async ({ page }) => {
    await mockPublicPricing(page);
    await openPricing(page);
    await tierCard(page, 'starter').getByRole('button', { name: 'Choose plan to Starter' }).click();
    await expect(page).toHaveURL(/\/for-hosts\/login/);
  });

  test('Managed CTA opens a prefilled sales inquiry instead of login', async ({ page }) => {
    await mockPublicPricing(page);
    await openPricing(page);
    await tierCard(page, 'managed')
      .getByRole('button', { name: 'Contact sales to Managed' })
      .click();
    await expect(page).toHaveURL(/\/contact\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('category')).toBe('business_inquiry');
    expect(url.searchParams.get('subject')).toBe('Managed plan inquiry');
  });

  test('a failed plans request shows retry and recovers', async ({ page }) => {
    let fail = true;
    await page.route('**/functions/v1/list-public-pricing-plans*', async (route) => {
      if (fail) await fulfillJson(route, { success: false, error: 'boom' }, 500);
      else await fulfillJson(route, { success: true, data: { plans: PLANS_E2E_CATALOG } });
    });
    await openPricing(page);
    await expect(page.getByText('Could not load plans.')).toBeVisible();
    await expect(page.locator('article[aria-labelledby^="plan-tier-"]')).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expectTierCards(page);
  });

  test('no plans returned renders no cards and no table', async ({ page }) => {
    await page.route('**/functions/v1/list-public-pricing-plans*', (route) =>
      fulfillJson(route, { success: true, data: { plans: [] } })
    );
    await openPricing(page);
    await expect(page.locator('article[aria-labelledby^="plan-tier-"]')).toHaveCount(0);
    await expect(compareTable(page)).toHaveCount(0);
  });

  for (const [name, width, height] of [
    ['phone', 375, 812],
    ['tablet', 768, 1024],
    ['laptop', 1024, 768],
  ] as const) {
    test(`no horizontal page overflow at ${name} width`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await mockPublicPricing(page);
      await openPricing(page);
      await expect(page.locator('article[aria-labelledby="plan-tier-free"]')).toHaveCount(1);
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test('carousel reaches Managed with the arrows on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockPublicPricing(page);
    await openPricing(page);
    const next = page.getByRole('button', { name: 'Next plans' });
    await expect(next).toBeVisible();
    for (let i = 0; i < 6 && (await next.isEnabled()); i += 1) await next.click();
    await expect(next).toBeDisabled();
    await expect(tierCard(page, 'managed')).toBeInViewport();
  });

  test('compare table scrolls inside its own container on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockPublicPricing(page);
    await openPricing(page);
    const scroller = compareTable(page).locator(
      'xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]'
    );
    const { scrollWidth, clientWidth } = await scroller.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    await expectNoPageHorizontalOverflow(page);
  });
});
