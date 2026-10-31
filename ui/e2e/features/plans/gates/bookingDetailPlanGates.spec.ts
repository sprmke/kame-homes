import { expect, test, type Page } from '@playwright/test';

import {
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
} from '../../team/shared/propertyTeamRbacHarness';
import { installTierGateMocks } from '../shared/tierGateMocks';

import type { TierCode } from '../../../../src/features/dashboard/plans/lib/planTierExpectations';

const BOOKING_ID = 'booking-plan-gates-e2e';

/** Ready for check-in with a stay guide token already issued. */
const BOOKING = {
  id: BOOKING_ID,
  created_at: '2026-01-01T00:00:00.000Z',
  property_id: TEAM_E2E_PROPERTY_ID,
  property_slug: TEAM_E2E_PROPERTY_SLUG,
  primary_guest_name: 'Jane Guest',
  guest_facebook_name: 'Jane Guest',
  guest_email: 'jane.guest@example.com',
  number_of_adults: 2,
  number_of_children: 0,
  check_in_date: '12-20-2026',
  check_out_date: '12-22-2026',
  status: 'READY_FOR_CHECKIN',
  status_updated_at: '2026-12-01T00:00:00.000Z',
  need_parking: false,
  has_pets: false,
  stay_guide_token: 'tok-plan-gates-e2e',
  document_requirement_completions: {},
};

type Calls = { aiReview: number; issueStayGuide: number };

async function openBooking(page: Page, tier: TierCode): Promise<Calls> {
  const calls: Calls = { aiReview: 0, issueStayGuide: 0 };
  await installTierGateMocks(page, tier);
  await page.route('**/rest/v1/guest_submissions*', (route) => {
    const single = (route.request().headers()['accept'] ?? '').includes('pgrst.object');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? BOOKING : [BOOKING]),
    });
  });
  await page.route('**/functions/v1/booking-ai-review*', (route) => {
    calls.aiReview += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/functions/v1/issue-guest-stay-guide-token*', (route) => {
    calls.issueStayGuide += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(
    `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/bookings/${BOOKING_ID}`
  );
  await expect(page.getByRole('heading', { name: /Jane Guest/ }).first()).toBeVisible({
    timeout: 20_000,
  });
  return calls;
}

const upgradeDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: /^Upgrade to / });

async function openActions(page: Page) {
  await page.getByRole('button', { name: 'More actions' }).first().click();
}

test.describe('@ci booking detail plan gates', () => {
  test('Free: stay guide row shows the Pro pill and opens the upgrade modal', async ({ page }) => {
    const calls = await openBooking(page, 'free');
    await openActions(page);

    await expect(page.getByRole('menuitem', { name: /Open stay guide/ })).toHaveCount(0);
    const row = page.getByRole('menuitem', { name: /Stay guide link/ });
    await expect(row.getByText('Pro', { exact: true })).toBeVisible();

    await row.click();
    await expect(upgradeDialog(page)).toContainText('Upgrade to Pro');
    expect(calls.issueStayGuide, 'Free must not mint a stay guide link').toBe(0);
  });

  test('Free: AI Summary Run checks opens the upgrade modal without calling AI', async ({
    page,
  }) => {
    const calls = await openBooking(page, 'free');
    await openActions(page);
    await page.getByRole('menuitem', { name: 'AI Summary' }).click();

    await page.getByRole('button', { name: 'Run checks' }).click();
    await expect(upgradeDialog(page)).toContainText('Upgrade to Pro');
    expect(calls.aiReview, 'a gated AI run must not call the server').toBe(0);
  });

  test('Pro: stay guide offers open and copy, no upgrade prompt', async ({ page }) => {
    await openBooking(page, 'growth');
    await openActions(page);

    await expect(page.getByRole('menuitem', { name: /Open stay guide/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Copy stay guide link/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^Stay guide link/ })).toHaveCount(0);
  });

  test('Pro: AI Summary Run checks calls the AI review', async ({ page }) => {
    const calls = await openBooking(page, 'growth');
    await openActions(page);
    await page.getByRole('menuitem', { name: 'AI Summary' }).click();

    await page.getByRole('button', { name: 'Run checks' }).click();
    await expect.poll(() => calls.aiReview).toBe(1);
    await expect(upgradeDialog(page)).toHaveCount(0);
  });
});
