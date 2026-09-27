import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  TIER_ORDER,
  TIER_TITLES,
  type TierCode,
} from '../../../../src/features/dashboard/plans/lib/planTierExpectations';
import {
  GOLDEN_MINIMUM_TIER,
  type GoldenPlan,
} from '../../../../src/features/dashboard/plans/lib/planTierGolden';
import {
  analyticsPaths,
  installAnalyticsAiReviewRoutes,
} from '../../analytics/shared/aiReviewHarness';
import { retryThroughDevReload } from '../shared/planPageAssertions';
import { installTierGateMocks, type TierGateOptions } from '../shared/tierGateMocks';

const PROPERTY = '/org/kame-homes-ph/property/solea-mactan';

type Feature = keyof GoldenPlan['features'];

type GateSurface = {
  /** Plan feature this control is gated by. The minimum tier comes from the golden matrix. */
  feature: Feature;
  name: string;
  path: string;
  mocks?: TierGateOptions;
  control: (page: Page) => Locator;
  /** Element that holds the control and its plan pill (the pill is a sibling or child). */
  scope: (control: Locator) => Locator;
  /**
   * `modal`: clicking below the minimum tier opens the upgrade dialog.
   * `pill`: the surface is explore-open, so only the plan pill is asserted.
   */
  behaviour: 'modal' | 'pill';
  /** Extra step after clicking the control (e.g. choose an item in its menu). */
  afterClick?: (page: Page) => Promise<void>;
  /** The control carries no plan pill; only the upgrade dialog signals the gate. */
  noPill?: boolean;
  /**
   * Edge function the action calls once allowed. Stubbed with a tiny CSV, and asserted to be
   * called on entitled tiers and never below the minimum tier.
   */
  actionEndpoint?: string;
  /** Only this HTTP method counts as the action (the endpoint may also serve reads on load). */
  actionMethod?: string;
  /** Seed data or routes the surface needs before the control is usable. */
  seed?: (page: Page) => Promise<void>;
  /** Steps after navigation that reveal the control (e.g. switch to a tab). */
  reveal?: (page: Page) => Promise<void>;
};

/** Export CSV is disabled on an entitled plan when there is nothing to export. */
const seedActivityEvent = async (page: Page) => {
  await page.route('**/functions/v1/list-activity-log*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          nextCursor: null,
          events: [
            {
              id: 'evt-gates-e2e',
              createdAt: '2026-09-10T02:00:00.000Z',
              organizationId: 'org-team-e2e-001',
              propertyId: null,
              parkingId: null,
              scope: 'org',
              actorType: 'org_owner',
              actorUserId: null,
              actorEmail: 'owner@example.com',
              actorDisplayName: 'Plans Owner',
              actorRole: 'owner',
              actorMemberId: null,
              action: 'org.settings.updated',
              category: 'settings',
              severity: 'info',
              targetType: null,
              targetId: null,
              targetLabel: null,
              summary: 'Updated organization settings',
              changes: null,
              metadata: {},
              ipPrefix: null,
              userAgent: null,
              source: 'dashboard',
              requestId: null,
            },
          ],
        },
      }),
    })
  );
};

const ownScope = (control: Locator) => control;
const parentScope = (control: Locator) => control.locator('xpath=..');
const firstMenuItem = async (page: Page) => {
  await page.getByRole('menuitem').first().click();
};

const SURFACES: GateSurface[] = [
  {
    feature: 'financeReporting',
    name: 'Finance: Export report',
    path: `${PROPERTY}/finance`,
    control: (page) => page.getByRole('button', { name: /^Export report/ }),
    scope: ownScope,
    behaviour: 'modal',
    afterClick: firstMenuItem,
  },
  {
    feature: 'maintenanceReporting',
    name: 'Maintenance: Export report',
    path: `${PROPERTY}/maintenance`,
    control: (page) => page.getByRole('button', { name: /^Export report/ }),
    scope: ownScope,
    behaviour: 'modal',
    afterClick: firstMenuItem,
  },
  {
    feature: 'customTemplates',
    name: 'Templates: Add Custom Template',
    path: `${PROPERTY}/templates`,
    control: (page) => page.getByRole('button', { name: /Add Custom Template/ }),
    scope: parentScope,
    behaviour: 'modal',
  },
  {
    feature: 'activityLogExport',
    name: 'Activity log: Export CSV',
    path: '/org/kame-homes-ph/activity',
    mocks: { orgHub: true },
    control: (page) => page.getByRole('button', { name: 'Export CSV' }),
    scope: parentScope,
    behaviour: 'modal',
    noPill: true,
    actionEndpoint: 'activity-log-export',
    seed: seedActivityEvent,
  },
  {
    feature: 'analyticsInsights',
    name: 'Analytics: Export PDF',
    path: analyticsPaths.analytics,
    control: (page) => page.getByRole('button', { name: /^Export PDF/ }),
    scope: parentScope,
    behaviour: 'modal',
    seed: installAnalyticsAiReviewRoutes,
  },
  {
    feature: 'analyticsInsights',
    name: 'Analytics: AI review refresh',
    path: analyticsPaths.analytics,
    control: (page) => page.getByRole('button', { name: /AI review for this month/ }),
    scope: parentScope,
    behaviour: 'modal',
    actionEndpoint: 'analytics-ai-review',
    actionMethod: 'POST',
    seed: installAnalyticsAiReviewRoutes,
    reveal: async (page) => {
      await page.getByRole('tab', { name: 'AI review' }).click();
    },
  },
  {
    feature: 'marketingStudio',
    name: 'Marketing Studio: Download PNG',
    path: `${PROPERTY}/marketing`,
    control: (page) => page.getByRole('button', { name: /Download PNG/ }),
    scope: parentScope,
    behaviour: 'modal',
  },
  {
    feature: 'marketingPublishLimitPerGroup',
    name: 'Marketing Studio: Publish',
    path: `${PROPERTY}/marketing`,
    control: (page) => page.getByRole('button', { name: /^Publish/ }),
    scope: parentScope,
    behaviour: 'modal',
  },
  {
    feature: 'metaChatChannel',
    name: 'Inbox: Connect a channel',
    path: `${PROPERTY}/inbox`,
    control: (page) => page.getByRole('button', { name: /Connect/ }).first(),
    scope: parentScope,
    behaviour: 'modal',
  },
  {
    feature: 'bookingImport',
    name: 'Bookings: Import',
    path: `${PROPERTY}/bookings`,
    control: (page) => page.getByRole('button', { name: /^Import/ }),
    scope: parentScope,
    behaviour: 'pill',
  },
  {
    feature: 'smartPricing',
    name: 'Pricing: Smart Pricing',
    path: `${PROPERTY}/pricing`,
    control: (page) => page.getByRole('button', { name: /^Smart Pricing/ }),
    scope: parentScope,
    behaviour: 'pill',
  },
  {
    feature: 'copyPropertySettings',
    name: 'Org properties: Copy settings',
    path: '/org/kame-homes-ph/properties',
    mocks: { orgHub: true, multiProperty: true },
    control: (page) => page.getByRole('button', { name: /Copy settings/ }),
    scope: parentScope,
    behaviour: 'pill',
  },
];

const tierIndex = (code: string) => TIER_ORDER.indexOf(code as TierCode);

test.describe('@ci plan feature gates, per tier', () => {
  test.describe.configure({ mode: 'parallel' });
  // First hit on a route compiles it in the Vite dev server; parallel workers make that slow.
  test.setTimeout(75_000);

  for (const surface of SURFACES) {
    const minCode = GOLDEN_MINIMUM_TIER[surface.feature];
    const minTitle = TIER_TITLES[minCode as TierCode];

    for (const tier of TIER_ORDER) {
      const entitled = tierIndex(tier) >= tierIndex(minCode);
      const verdict = entitled ? 'is open' : `asks for ${minTitle}`;

      test(`${surface.name} on ${TIER_TITLES[tier]} ${verdict}`, async ({ page }) => {
        await installTierGateMocks(page, tier, surface.mocks);
        const actionCalls: string[] = [];
        if (surface.actionEndpoint) {
          // Recorded from the request stream so a surface's own stub can answer it.
          page.on('request', (request) => {
            if (
              request.url().includes(`/functions/v1/${surface.actionEndpoint}`) &&
              request.method() !== 'OPTIONS' &&
              (!surface.actionMethod || request.method() === surface.actionMethod)
            )
              actionCalls.push(request.url());
          });
          await page.route(`**/functions/v1/${surface.actionEndpoint}*`, async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'text/csv',
              headers: { 'content-disposition': 'attachment; filename="export.csv"' },
              body: 'id\n1\n',
            });
          });
        }
        await surface.seed?.(page);
        const control = surface.control(page);
        await retryThroughDevReload(async () => {
          await page.goto(surface.path);
          await surface.reveal?.(page);
          await expect(control).toBeVisible();
        });
        const scope = surface.scope(control);

        // The plan pill names the minimum tier below it and disappears from it upward.
        if (!surface.noPill) {
          const pill = scope.getByText(minTitle, { exact: true });
          if (entitled) await expect(pill).toHaveCount(0);
          else await expect(pill).toHaveCount(1);
        }

        if (surface.behaviour !== 'modal') return;

        await control.click();
        if (surface.afterClick) await surface.afterClick(page);

        const upgradeDialog = page.getByRole('dialog').filter({ hasText: /^Upgrade to / });
        if (entitled) {
          // Give a wrongly-open modal time to appear before asserting it did not.
          await page.waitForTimeout(1500);
          await expect(upgradeDialog).toHaveCount(0);
          if (surface.actionEndpoint)
            expect(actionCalls, 'allowed action must call the server').toHaveLength(1);
        } else {
          await expect(upgradeDialog).toBeVisible();
          await expect(upgradeDialog).toContainText(`Upgrade to ${minTitle}`);
          if (surface.actionEndpoint)
            expect(actionCalls, 'a gated action must not call the server').toHaveLength(0);
        }
      });
    }
  }
});
