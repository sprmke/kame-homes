/**
 * Gate contract for the credit-spending / audit surfaces added by the team permissions plan
 * coverage audit. Handlers bind a port at import time (see authWrapperRejection.test.ts), so
 * this does not call them over HTTP. It proves, for each handler, that:
 *   1. the handler source requires the expected permission leaf and plan feature (403 / 402 path),
 *   2. a role without the leaf is rejected by the same `permissions.includes(leaf)` check the
 *      verifier uses, while Full Access passes,
 *   3. a plan without the feature is rejected by `isFeatureEnabled`.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  DEFAULT_PLAN_FEATURES,
  isFeatureEnabled,
  type PlanFeatureKey,
} from '../_shared/planFeatures.ts';
import {
  allTeamPermissions,
  normalizePermissionIds,
  type TeamPermissionId,
} from '../_shared/propertyTeamPermissions.ts';
import { SEEDED_TEMPLATE_PERMISSIONS } from '../_shared/propertyTeamTemplates.ts';

type Gate = {
  fn: string;
  leaf: TeamPermissionId;
  feature: PlanFeatureKey | null;
};

const GATES: Gate[] = [
  {
    fn: 'generate-marketing-media',
    leaf: 'marketing.generate.image:add',
    feature: 'aiMarketingImageGeneration',
  },
  {
    fn: 'generate-marketing-media',
    leaf: 'marketing.generate.video:add',
    feature: 'aiMarketingVideoGeneration',
  },
  {
    fn: 'upload-marketing-generation-reference',
    leaf: 'marketing.generate.image:add',
    feature: 'aiMarketingImageGeneration',
  },
  {
    fn: 'generate-marketing-caption',
    leaf: 'marketing.generate:add',
    feature: 'aiMarketingGeneration',
  },
  {
    fn: 'generate-marketing-template',
    leaf: 'marketing.generate:add',
    feature: 'aiMarketingGeneration',
  },
  {
    fn: 'analytics-ai-review',
    leaf: 'analytics.aiReview:add',
    feature: 'analyticsInsights',
  },
  {
    fn: 'smart-pricing-settings',
    leaf: 'pricing.smartPricing:edit',
    feature: 'smartPricing',
  },
  {
    fn: 'smart-pricing-preview',
    leaf: 'pricing.smartPricing:edit',
    feature: 'smartPricing',
  },
  {
    fn: 'smart-pricing-apply',
    leaf: 'pricing.smartPricing:edit',
    feature: 'smartPricing',
  },
  {
    fn: 'dashboard-assistant-chat',
    leaf: 'assistant:view',
    feature: 'aiDashboardAssistant',
  },
];

const READ_ONLY = SEEDED_TEMPLATE_PERMISSIONS.READ_ONLY as readonly string[];
const OPERATIONS = SEEDED_TEMPLATE_PERMISSIONS.OPERATIONS as readonly string[];
const FULL_ACCESS = allTeamPermissions() as readonly string[];

for (const { fn, leaf, feature } of GATES) {
  Deno.test(`${fn}: source requires ${leaf}${feature ? ` + ${feature}` : ''}`, async () => {
    const source = await Deno.readTextFile(new URL(`../${fn}/index.ts`, import.meta.url));
    assert(source.includes(`'${leaf}'`), `${fn} must reference ${leaf}`);
    if (feature) {
      assert(source.includes(`'${feature}'`), `${fn} must reference ${feature}`);
    }
  });

  Deno.test(`${fn}: Full Access passes ${leaf}; Read Only is rejected`, () => {
    assertEquals(FULL_ACCESS.includes(leaf), true);
    assertEquals(READ_ONLY.includes(leaf), false);
    // Stored permissions round-trip through normalizePermissionIds without gaining the leaf.
    assertEquals(normalizePermissionIds(READ_ONLY).includes(leaf), false);
  });

  if (feature) {
    Deno.test(`${fn}: Free plan is rejected for ${feature}`, () => {
      assertEquals(isFeatureEnabled(DEFAULT_PLAN_FEATURES, feature), false);
      assertEquals(isFeatureEnabled({ ...DEFAULT_PLAN_FEATURES, [feature]: true }, feature), true);
    });
  }
}

Deno.test('Operations is rejected for every AI-spend leaf but keeps text generation', () => {
  for (const leaf of [
    'marketing.generate.image:add',
    'marketing.generate.video:add',
    'analytics.aiReview:add',
    'pricing.smartPricing:edit',
  ]) {
    assertEquals(OPERATIONS.includes(leaf), false, leaf);
  }
  assertEquals(OPERATIONS.includes('marketing.generate:add'), true);
});

Deno.test('marketing-generations DELETE accepts any of the three generate leaves', async () => {
  const source = await Deno.readTextFile(
    new URL('../marketing-generations/index.ts', import.meta.url)
  );
  for (const leaf of [
    'marketing.generate:add',
    'marketing.generate.image:add',
    'marketing.generate.video:add',
  ]) {
    assert(source.includes(`'${leaf}'`), leaf);
  }
});

Deno.test('list-activity-log scopes non-admins by the activity:view leaf', async () => {
  const source = await Deno.readTextFile(new URL('../list-activity-log/index.ts', import.meta.url));
  assert(source.includes('resolveActivityViewableListingIdsForOrgUser'));
  assert(source.includes("'org.activity:view'"));
});
