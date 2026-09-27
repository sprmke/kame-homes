/**
 * Mocked org Plans upgrade + PayMongo checkout harness.
 * Intercepts edge functions and stubs PayMongo redirects — no live payment API calls.
 */

import { expect, type Page } from '@playwright/test';

import {
  dashboardStatsPayload,
  fulfillJson,
  installPlansE2eSession,
  organizationList,
  orgAccessPayload,
  PLAN_FREE,
  PLAN_GROWTH,
  PLAN_PRO,
  PLAN_STARTER,
  PLANS_E2E_CATALOG,
  PLANS_E2E_ORG_ID,
  PLANS_E2E_ORG_SLUG,
  PLANS_E2E_PROPERTY_ID,
  PLANS_E2E_PROPERTY_SLUG,
  plansE2ePaths,
  planChargedPhp,
} from './orgPlanHarnessShared';

export {
  PLAN_FREE,
  PLAN_GROWTH,
  PLAN_PRO,
  PLAN_STARTER,
  PLANS_E2E_ORG_SLUG,
  PLANS_E2E_PROPERTY_SLUG,
  plansE2ePaths,
};

type PendingCheckout = {
  transactionId: string;
  planId: string;
  checkoutUrl: string;
};

export type PaymentTransaction = {
  id: string;
  planId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  paymentMethodType: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type PlansCheckoutHarnessOptions = {
  accessKind?: 'owner' | 'member';
  subscriptionPlanId?: string | null;
  subscriptionStatus?: 'active' | 'trialing' | 'past_due' | 'suspended';
  pendingCheckout?: PendingCheckout | null;
  /** Fulfill pending checkout on the next org-plan poll (simulates webhook). */
  fulfillOnNextOrgPlanPoll?: boolean;
};

export type PlansCheckoutHarnessState = {
  accessKind: 'owner' | 'member';
  subscriptionPlanId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'suspended';
  pendingCheckout: PendingCheckout | null;
  transactions: PaymentTransaction[];
  checkoutCalls: string[];
  fulfillOnNextOrgPlanPoll: boolean;
  checkoutCreateShouldFail: string | null;
};

function planById(planId: string | null) {
  return PLANS_E2E_CATALOG.find((plan) => plan.id === planId) ?? null;
}

function effectivePlan(state: PlansCheckoutHarnessState) {
  return planById(state.subscriptionPlanId) ?? planById(PLAN_FREE)!;
}

function orgPlanPayload(state: PlansCheckoutHarnessState) {
  const currentPlan = planById(state.subscriptionPlanId);
  const pendingUrl = state.pendingCheckout?.checkoutUrl ?? null;
  const pendingPlanId = state.pendingCheckout?.planId ?? null;

  return {
    plans: PLANS_E2E_CATALOG,
    properties: [
      {
        id: PLANS_E2E_PROPERTY_ID,
        name: 'Solea Mactan',
        slug: PLANS_E2E_PROPERTY_SLUG,
        status: 'ACTIVE',
      },
    ],
    subscription: currentPlan
      ? {
          id: state.subscriptionId ?? 'sub-plans-checkout-e2e',
          planId: currentPlan.id,
          planCode: currentPlan.code,
          planName: currentPlan.name,
          pricingModel: 'subscription',
          status: state.subscriptionStatus,
          pricePhpSnapshot: planChargedPhp(currentPlan),
          currentPeriodStart: '2026-08-01T00:00:00.000Z',
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
          gracePeriodEndsAt: null,
        }
      : null,
    assignedPropertyIds: currentPlan ? [PLANS_E2E_PROPERTY_ID] : [],
    pendingCheckoutUrl: pendingUrl,
    pendingCheckoutPlanId: pendingPlanId,
    transactions: state.transactions,
  };
}

export function fulfillPendingCheckout(state: PlansCheckoutHarnessState, planId: string) {
  const plan = planById(planId);
  if (!plan) return;

  state.subscriptionPlanId = planId;
  state.subscriptionId = state.subscriptionId ?? 'sub-plans-checkout-e2e';
  state.subscriptionStatus = 'active';
  state.pendingCheckout = null;

  const txnId =
    state.transactions.find((txn) => txn.status === 'pending')?.id ?? `txn-e2e-${planId}`;
  const now = new Date().toISOString();
  const existing = state.transactions.find((txn) => txn.id === txnId);
  if (existing) {
    existing.status = 'paid';
    existing.paidAt = now;
    existing.checkoutUrl = null;
  } else {
    state.transactions.unshift({
      id: txnId,
      planId,
      amount: planChargedPhp(plan),
      currency: 'PHP',
      status: 'paid',
      paymentMethodType: 'qrph',
      checkoutUrl: null,
      createdAt: now,
      paidAt: now,
    });
  }
}

function createPendingCheckout(state: PlansCheckoutHarnessState, planId: string): PendingCheckout {
  const plan = planById(planId);
  const transactionId = `txn-e2e-${state.checkoutCalls.length + 1}`;
  const checkoutUrl = `https://checkout.paymongo.com/e2e-${transactionId}`;
  const pending: PendingCheckout = { transactionId, planId, checkoutUrl };

  state.pendingCheckout = pending;
  state.transactions.unshift({
    id: transactionId,
    planId,
    amount: plan ? planChargedPhp(plan) : 0,
    currency: 'PHP',
    status: 'pending',
    paymentMethodType: null,
    checkoutUrl,
    createdAt: new Date().toISOString(),
    paidAt: null,
  });

  return pending;
}

/** Stub PayMongo Hosted Checkout — redirects back to Kame Homes billing return URLs. */
export async function installPaymongoCheckoutRedirectStub(
  page: Page,
  result: 'success' | 'cancelled' = 'success'
) {
  const returnUrl = `http://127.0.0.1:4173/org/${PLANS_E2E_ORG_SLUG}/plans?tab=billing&checkout=${result}`;

  await page.route('**/checkout.paymongo.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!DOCTYPE html><html><head><meta charset="utf-8"><script>window.location.replace(${JSON.stringify(returnUrl)});</script></head><body></body></html>`,
    });
  });

  await page.addInitScript(
    ({ orgSlug, checkoutResult, origin }) => {
      const returnPath = `${origin}/org/${orgSlug}/plans?tab=billing&checkout=${checkoutResult}`;
      const redirectToApp = () => {
        window.location.replace(returnPath);
      };

      const originalAssign = window.location.assign.bind(window.location);
      window.location.assign = (url: string | URL) => {
        const href = String(url);
        if (href.includes('checkout.paymongo.com')) {
          redirectToApp();
          return;
        }
        originalAssign(url);
      };

      const descriptor = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');
      if (descriptor?.set) {
        const originalSet = descriptor.set;
        Object.defineProperty(window.location, 'href', {
          ...descriptor,
          set(value: string) {
            if (String(value).includes('checkout.paymongo.com')) {
              redirectToApp();
              return;
            }
            originalSet.call(window.location, value);
          },
        });
      }
    },
    { orgSlug: PLANS_E2E_ORG_SLUG, checkoutResult: result, origin: 'http://127.0.0.1:4173' }
  );
}

export async function seedActiveCheckoutSession(
  page: Page,
  input: PendingCheckout & { previousPlanId: string | null }
) {
  await page.addInitScript(
    ({ orgId, session }) => {
      sessionStorage.setItem('gfm:org-plan-checkout', JSON.stringify(session));
    },
    {
      orgId: PLANS_E2E_ORG_ID,
      session: {
        orgId: PLANS_E2E_ORG_ID,
        transactionId: input.transactionId,
        startedAt: Date.now(),
        previousPlanId: input.previousPlanId,
        targetPlanId: input.planId,
      },
    }
  );
}

export async function seedExpiredCheckoutWatch(page: Page, input: PendingCheckout) {
  await page.addInitScript(
    ({ orgId, session }) => {
      sessionStorage.setItem('gfm:org-plan-checkout', JSON.stringify(session));
    },
    {
      orgId: PLANS_E2E_ORG_ID,
      session: {
        orgId: PLANS_E2E_ORG_ID,
        transactionId: input.transactionId,
        startedAt: Date.now() - 16 * 60 * 1000,
        previousPlanId: PLAN_STARTER,
        targetPlanId: input.planId,
      },
    }
  );
}

export async function installPlansCheckoutMocks(
  page: Page,
  options: PlansCheckoutHarnessOptions = {}
) {
  const state: PlansCheckoutHarnessState = {
    accessKind: options.accessKind ?? 'owner',
    subscriptionPlanId:
      options.subscriptionPlanId === undefined ? PLAN_STARTER : options.subscriptionPlanId,
    subscriptionId:
      options.subscriptionPlanId === undefined || options.subscriptionPlanId
        ? 'sub-plans-checkout-e2e'
        : null,
    subscriptionStatus: options.subscriptionStatus ?? 'active',
    pendingCheckout: options.pendingCheckout ?? null,
    transactions: options.pendingCheckout
      ? [
          {
            id: options.pendingCheckout.transactionId,
            planId: options.pendingCheckout.planId,
            amount: planChargedPhp(planById(options.pendingCheckout.planId)!),
            currency: 'PHP',
            status: 'pending',
            paymentMethodType: null,
            checkoutUrl: options.pendingCheckout.checkoutUrl,
            createdAt: '2026-09-02T00:00:00.000Z',
            paidAt: null,
          },
        ]
      : [],
    checkoutCalls: [],
    fulfillOnNextOrgPlanPoll: options.fulfillOnNextOrgPlanPoll ?? false,
    checkoutCreateShouldFail: null,
  };

  await installPlansE2eSession(page);

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'list-organizations':
        await fulfillJson(route, { success: true, data: organizationList(state.accessKind) });
        return;
      case 'list-properties':
        await fulfillJson(route, {
          success: true,
          data: {
            properties: [
              {
                id: PLANS_E2E_PROPERTY_ID,
                organizationId: PLANS_E2E_ORG_ID,
                name: 'Solea Mactan',
                slug: PLANS_E2E_PROPERTY_SLUG,
                type: 'condo',
                status: 'ACTIVE',
                address: 'Mactan',
                towerAndUnit: null,
                tower: 'Tower A',
                unitNumber: '1204',
                residenceName: 'Solea Mactan',
                maxGuests: 4,
                settings: {},
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        });
        return;
      case 'list-parkings':
        await fulfillJson(route, { success: true, data: { parkings: [] } });
        return;
      case 'org-access':
        await fulfillJson(route, { success: true, data: orgAccessPayload(state.accessKind) });
        return;
      case 'dashboard-stats':
        await fulfillJson(route, { success: true, data: dashboardStatsPayload() });
        return;
      case 'list-bookings':
        await fulfillJson(route, { success: true, data: [], total: 0 });
        return;
      case 'org-settings':
        await fulfillJson(route, {
          success: true,
          data: {
            facebookPageUrl: '',
            airbnbUrl: '',
            instagramUrl: '',
            tiktokUrl: '',
            emailLogoUrl: '',
            updatedAt: null,
            fieldSources: {},
          },
        });
        return;
      case 'org-plan': {
        if (
          state.fulfillOnNextOrgPlanPoll &&
          state.pendingCheckout &&
          state.pendingCheckout.planId
        ) {
          fulfillPendingCheckout(state, state.pendingCheckout.planId);
          state.fulfillOnNextOrgPlanPoll = false;
        }
        await fulfillJson(route, { success: true, data: orgPlanPayload(state) });
        return;
      }
      case 'create-org-subscription-checkout': {
        if (state.checkoutCreateShouldFail) {
          await fulfillJson(route, { success: false, error: state.checkoutCreateShouldFail }, 502);
          return;
        }
        const body = route.request().postDataJSON() as { planId?: string };
        const planId = String(body.planId ?? '');
        state.checkoutCalls.push(planId);

        if (
          state.pendingCheckout?.planId === planId &&
          state.transactions.some((txn) => txn.status === 'pending' && txn.planId === planId)
        ) {
          await fulfillJson(route, {
            success: true,
            data: {
              checkoutUrl: state.pendingCheckout.checkoutUrl,
              transactionId: state.pendingCheckout.transactionId,
              reused: true,
            },
          });
          return;
        }

        const pending = createPendingCheckout(state, planId);
        await fulfillJson(route, {
          success: true,
          data: {
            checkoutUrl: pending.checkoutUrl,
            transactionId: pending.transactionId,
            reused: false,
          },
        });
        return;
      }
      case 'property-entitlements':
        await fulfillJson(route, {
          success: true,
          data: {
            // Entitlements follow the org's tier (Free when nothing is subscribed), like the server.
            ...effectivePlan(state).features,
            planId: effectivePlan(state).id,
            planCode: effectivePlan(state).code,
            planName: effectivePlan(state).name,
            pricingModel: 'subscription',
            status: state.subscriptionStatus,
            propertySubscriptionId: state.subscriptionId ?? '',
          },
        });
        return;
      case 'notifications-list':
        await fulfillJson(route, {
          success: true,
          data: { notifications: [], nextCursor: null, unreadCount: 0 },
        });
        return;
      default:
        await fulfillJson(route, { success: true, data: {} });
        return;
    }
  });

  return state;
}

export async function openOrgPlansBilling(page: Page) {
  await page.goto(plansE2ePaths.orgPlans('billing'));
  await expect(page.getByRole('heading', { name: 'Plans & Billing' }).first()).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByRole('tab', { name: 'Billing' })).toBeVisible({ timeout: 15_000 });
}

export async function openOrgPlansCompare(page: Page) {
  await page.goto(plansE2ePaths.orgPlans('compare'));
  await expect(page.getByRole('heading', { name: 'Plans & Billing' }).first()).toBeVisible({
    timeout: 25_000,
  });
}

export async function openUpgradeReview(page: Page, targetPlanName: string) {
  const plansRegion = page.getByRole('region', { name: 'Subscription plans' });
  if (await plansRegion.isVisible()) {
    const card = page.locator('article').filter({
      has: page.getByRole('heading', { name: targetPlanName, exact: true }),
    });
    await card.scrollIntoViewIfNeeded();
    await card
      .getByRole('button', {
        name: new RegExp(`^(Upgrade|Choose plan) to ${targetPlanName}$`),
      })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    return;
  }

  await page
    .getByRole('button', { name: `Upgrade to ${targetPlanName}` })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function continueToPayment(page: Page) {
  await page.getByRole('button', { name: 'Continue to payment' }).click();
}

export async function resumePendingPayment(page: Page) {
  const resume = page.getByRole('button', { name: 'Resume payment' });
  if ((await resume.count()) > 0) {
    await resume.first().click();
    return;
  }
  await page.getByRole('button', { name: 'Open checkout' }).first().click();
}
