/**
 * Tier-aware mocks for feature-gate E2E. Layers a per-tier `property-entitlements` and
 * `org-plan` on top of the property RBAC harness (later Playwright routes win), so every
 * gate sees exactly the golden features for the tier under test.
 */

import { fulfillJson, planChargedPhp } from './orgPlanHarnessShared';
import {
  goldenPlanId,
  goldenSoldPlanDtos,
} from '../../../../src/features/dashboard/plans/lib/planTierGolden';
import {
  installPropertyTeamRbacMocks,
  TEAM_E2E_PROPERTY_ID,
  type PropertyTeamRbacMockOpts,
} from '../../team/shared/propertyTeamRbacHarness';

import type { TierCode } from '../../../../src/features/dashboard/plans/lib/planTierExpectations';
import type { Page } from '@playwright/test';

export type TierGateOptions = PropertyTeamRbacMockOpts & {
  template?: 'full_access' | 'operations' | 'read_only';
  /** Subscription status. `past_due` and `suspended` change what the gates allow. */
  status?: 'active' | 'trialing' | 'past_due' | 'suspended';
};

export async function installTierGateMocks(
  page: Page,
  tier: TierCode,
  options: TierGateOptions = {}
) {
  const { template = 'full_access', status = 'active', ...rbacOptions } = options;
  await installPropertyTeamRbacMocks(page, template, {
    // The harness's own entitlement blob is replaced below; keep its plan-specific
    // fixtures (video gate) from fighting the tier.
    videoPlanAllowed: true,
    ...rbacOptions,
  });

  const plans = goldenSoldPlanDtos();
  const plan = plans.find((p) => p.code === tier)!;

  await page.route('**/functions/v1/property-entitlements*', (route) =>
    fulfillJson(route, {
      success: true,
      data: {
        ...plan.features,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        pricingModel: 'subscription',
        status,
        propertySubscriptionId: tier === 'free' ? '' : 'sub-tier-gates-e2e',
      },
    })
  );

  await page.route('**/functions/v1/org-plan*', (route) =>
    fulfillJson(route, {
      success: true,
      data: {
        plans,
        properties: [
          {
            id: TEAM_E2E_PROPERTY_ID,
            name: 'Solea Mactan',
            slug: 'solea-mactan',
            status: 'ACTIVE',
          },
        ],
        subscription:
          tier === 'free'
            ? null
            : {
                id: 'sub-tier-gates-e2e',
                planId: goldenPlanId(tier),
                planCode: plan.code,
                planName: plan.name,
                pricingModel: 'subscription',
                status,
                pricePhpSnapshot: planChargedPhp(plan),
                currentPeriodStart: '2026-09-01T00:00:00.000Z',
                currentPeriodEnd: '2026-10-01T00:00:00.000Z',
                gracePeriodEndsAt: null,
              },
        assignedPropertyIds: tier === 'free' ? [] : [TEAM_E2E_PROPERTY_ID],
        pendingCheckoutUrl: null,
        pendingCheckoutPlanId: null,
        transactions: [],
      },
    })
  );
}
