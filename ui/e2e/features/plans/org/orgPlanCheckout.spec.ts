import { expect, test } from '@playwright/test';

import {
  continueToPayment,
  installPaymongoCheckoutRedirectStub,
  installPlansCheckoutMocks,
  openOrgPlansBilling,
  openUpgradeReview,
  PLAN_GROWTH,
  PLAN_STARTER,
  plansE2ePaths,
  resumePendingPayment,
  seedActiveCheckoutSession,
  seedExpiredCheckoutWatch,
} from '../shared/orgPlanCheckoutHarness';

test.describe('@ci org plan upgrade checkout', () => {
  test('upgrade review opens and starts PayMongo checkout', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, { subscriptionPlanId: PLAN_STARTER });
    await installPaymongoCheckoutRedirectStub(page, 'success');

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openUpgradeReview(page, 'Pro');
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm downgrade' })).toHaveCount(0);

    await continueToPayment(page);
    await expect(page).toHaveURL(/tab=billing&checkout=success/);
    expect(state.checkoutCalls).toEqual([PLAN_GROWTH]);
  });

  test('successful return confirms payment and shows celebration modal', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, { subscriptionPlanId: PLAN_STARTER });
    await installPaymongoCheckoutRedirectStub(page, 'success');

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openUpgradeReview(page, 'Pro');
    await continueToPayment(page);

    await expect(page).toHaveURL(/checkout=success/);
    await expect(page.getByText('Confirming payment…')).toBeVisible({ timeout: 10_000 });

    state.fulfillOnNextOrgPlanPoll = true;
    await expect(page.getByRole('dialog').getByText(/You're on Pro/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Plan updated')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start exploring' })).toBeVisible();

    await expect(page.getByRole('dialog').getByText('Content Studio')).toBeVisible();

    await page.getByRole('button', { name: 'Start exploring' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.subscriptionPlanId).toBe(PLAN_GROWTH);
  });

  test('cancelled PayMongo return shows cancelled status on billing', async ({ page }) => {
    await installPlansCheckoutMocks(page, { subscriptionPlanId: PLAN_STARTER });
    await installPaymongoCheckoutRedirectStub(page, 'cancelled');

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openUpgradeReview(page, 'Pro');
    await continueToPayment(page);

    await expect(page).toHaveURL(/checkout=cancelled/);
    await expect(page.getByText('Payment cancelled.')).toBeVisible({ timeout: 10_000 });
  });

  test('pending checkout shows resume payment and confirming banner', async ({ page }) => {
    const pending = {
      transactionId: 'txn-pending-resume',
      planId: PLAN_GROWTH,
      checkoutUrl: 'https://checkout.paymongo.com/e2e-resume',
    };
    const state = await installPlansCheckoutMocks(page, {
      subscriptionPlanId: PLAN_STARTER,
      pendingCheckout: pending,
    });
    await installPaymongoCheckoutRedirectStub(page, 'success');

    await openOrgPlansBilling(page);
    await expect(page.getByText('Confirming payment…')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Resume payment|Open checkout/ }).first()
    ).toBeVisible();

    await resumePendingPayment(page);
    await expect(page).toHaveURL(/checkout=success/);
    expect(state.checkoutCalls).toEqual([PLAN_GROWTH]);
  });

  test('checkout watch timeout offers resume payment', async ({ page }) => {
    const pending = {
      transactionId: 'txn-pending-timeout',
      planId: PLAN_GROWTH,
      checkoutUrl: 'https://checkout.paymongo.com/e2e-timeout',
    };
    await installPlansCheckoutMocks(page, {
      subscriptionPlanId: PLAN_STARTER,
      pendingCheckout: pending,
    });
    await seedExpiredCheckoutWatch(page, pending);

    await openOrgPlansBilling(page);
    await expect(page.getByText(/Payment is still pending/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Resume payment' }).first()).toBeVisible();
  });

  test('billing lists pending transaction status', async ({ page }) => {
    await installPlansCheckoutMocks(page, {
      subscriptionPlanId: PLAN_STARTER,
      pendingCheckout: {
        transactionId: 'txn-list-pending',
        planId: PLAN_GROWTH,
        checkoutUrl: 'https://checkout.paymongo.com/e2e-list',
      },
    });

    await openOrgPlansBilling(page);
    await expect(page.getByRole('heading', { name: 'Payment history' })).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(page.getByText('₱799')).toBeVisible();
  });

  test('non-owner cannot start paid upgrade', async ({ page }) => {
    await installPlansCheckoutMocks(page, {
      accessKind: 'member',
      subscriptionPlanId: PLAN_STARTER,
    });

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();

    await expect(page.getByRole('button', { name: /^Upgrade$/ })).toHaveCount(0);
  });

  test('first purchase from free tier can checkout starter', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, { subscriptionPlanId: null });
    await installPaymongoCheckoutRedirectStub(page, 'success');

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openUpgradeReview(page, 'Starter');
    await continueToPayment(page);

    await expect(page).toHaveURL(/checkout=success/);
    expect(state.checkoutCalls).toEqual([PLAN_STARTER]);
  });

  test('celebration modal compare plans switches to compare tab', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, { subscriptionPlanId: PLAN_STARTER });
    await installPaymongoCheckoutRedirectStub(page, 'success');

    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    await openUpgradeReview(page, 'Pro');
    await continueToPayment(page);

    await expect(page).toHaveURL(/checkout=success/);
    await expect(page.getByText('Confirming payment…')).toBeVisible({ timeout: 10_000 });
    state.fulfillOnNextOrgPlanPoll = true;
    await expect(page.getByRole('dialog').getByText(/You're on Pro/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Compare plans' }).click();
    await expect(page.getByRole('tab', { name: 'Compare' })).toHaveAttribute(
      'data-state',
      'active'
    );
  });

  test('checkout API failure surfaces error toast', async ({ page }) => {
    const state = await installPlansCheckoutMocks(page, { subscriptionPlanId: PLAN_STARTER });
    await openOrgPlansBilling(page);
    await page.getByRole('tab', { name: 'Plans' }).click();
    state.checkoutCreateShouldFail = 'PayMongo is temporarily unavailable';

    await openUpgradeReview(page, 'Pro');
    await continueToPayment(page);

    await expect(page.getByText('PayMongo is temporarily unavailable')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
    expect(state.checkoutCalls).toEqual([]);
  });

  test('resume payment reuses existing pending checkout', async ({ page }) => {
    const pending = {
      transactionId: 'txn-reuse-pending',
      planId: PLAN_GROWTH,
      checkoutUrl: 'https://checkout.paymongo.com/e2e-reuse',
    };
    const state = await installPlansCheckoutMocks(page, {
      subscriptionPlanId: PLAN_STARTER,
      pendingCheckout: pending,
    });
    await installPaymongoCheckoutRedirectStub(page, 'success');

    await openOrgPlansBilling(page);
    await resumePendingPayment(page);

    await expect(page).toHaveURL(/checkout=success/);
    expect(state.checkoutCalls).toEqual([PLAN_GROWTH]);
    expect(state.transactions.filter((txn) => txn.status === 'pending')).toHaveLength(1);
  });

  test('direct success return URL enters confirming state', async ({ page }) => {
    const pending = {
      transactionId: 'txn-direct-return',
      planId: PLAN_GROWTH,
      checkoutUrl: 'https://checkout.paymongo.com/e2e-direct',
    };
    const state = await installPlansCheckoutMocks(page, {
      subscriptionPlanId: PLAN_STARTER,
      pendingCheckout: pending,
    });
    await seedActiveCheckoutSession(page, { ...pending, previousPlanId: PLAN_STARTER });

    await page.goto(plansE2ePaths.orgPlansCheckoutReturn('success'));
    await expect(page.getByText('Confirming payment…')).toBeVisible({ timeout: 15_000 });

    state.fulfillOnNextOrgPlanPoll = true;
    await expect(page.getByRole('dialog').getByText(/You're on Pro/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
