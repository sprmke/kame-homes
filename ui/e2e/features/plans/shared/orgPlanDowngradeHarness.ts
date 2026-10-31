/**
 * Mocked org Plans downgrade harness — PlanReviewDialog + apply-org-plan-downgrade.
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
  emptyPlanFeatures,
} from './orgPlanHarnessShared';

export {
  PLANS_E2E_ORG_SLUG,
  PLANS_E2E_PROPERTY_ID,
  PLANS_E2E_PROPERTY_SLUG,
  PLAN_FREE,
  PLAN_GROWTH,
  PLAN_STARTER,
  PLAN_PRO,
} from './orgPlanHarnessShared';

export type PlansDowngradeHarnessOptions = {
  accessKind?: 'owner' | 'member';
  subscriptionStatus?: 'active' | 'past_due' | 'suspended';
  subscriptionPlanId?: string;
};

type HarnessState = {
  accessKind: 'owner' | 'member';
  subscriptionStatus: 'active' | 'past_due' | 'suspended';
  subscriptionPlanId: string | null;
  subscriptionId: string | null;
  downgradeCalls: string[];
};

function orgPlanPayload(state: HarnessState) {
  const currentPlan =
    PLANS_E2E_CATALOG.find((plan) => plan.id === state.subscriptionPlanId) ?? null;
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
          id: state.subscriptionId ?? 'sub-plans-downgrade-e2e',
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
    pendingCheckoutUrl: null,
    pendingCheckoutPlanId: null,
    transactions: [],
  };
}

export async function installPlansDowngradeSession(page: Page) {
  await installPlansE2eSession(page);
}

export async function installPlansDowngradeMocks(
  page: Page,
  options: PlansDowngradeHarnessOptions = {}
) {
  const state: HarnessState = {
    accessKind: options.accessKind ?? 'owner',
    subscriptionStatus: options.subscriptionStatus ?? 'active',
    subscriptionPlanId: options.subscriptionPlanId ?? PLAN_GROWTH,
    subscriptionId: 'sub-plans-downgrade-e2e',
    downgradeCalls: [],
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
        await fulfillJson(route, {
          success: true,
          data: orgAccessPayload(state.accessKind),
        });
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
        await fulfillJson(route, { success: true, data: orgPlanPayload(state) });
        return;
      }
      case 'apply-org-plan-downgrade': {
        const body = route.request().postDataJSON() as { planId?: string };
        const targetPlanId = String(body.planId ?? '');
        state.downgradeCalls.push(targetPlanId);
        if (targetPlanId === PLAN_FREE) {
          state.subscriptionPlanId = null;
          state.subscriptionId = null;
        } else {
          state.subscriptionPlanId = targetPlanId;
        }
        await fulfillJson(route, {
          success: true,
          data: {
            orgSubscriptionId: state.subscriptionId,
            toFree: targetPlanId === PLAN_FREE,
          },
        });
        return;
      }
      case 'property-entitlements':
        await fulfillJson(route, {
          success: true,
          data: {
            ...emptyPlanFeatures(),
            planId: PLAN_GROWTH,
            planCode: 'growth',
            planName: 'Pro',
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

export async function openOrgPlansPage(page: Page) {
  await page.goto(plansE2ePaths.orgPlans('plans'));
  await expect(page.getByRole('heading', { name: 'Plans & Billing' }).first()).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByRole('tab', { name: 'Plans' })).toBeVisible({ timeout: 15_000 });
}

export async function openDowngradeReview(page: Page, targetPlanName: string) {
  await page
    .getByRole('button', { name: new RegExp(`Downgrade to ${targetPlanName}`, 'i') })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
