import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { parsePlanFeatures } from "./planFeatures.ts";

Deno.test(
  "parsePlanFeatures inherits aiMarketingImageGeneration from marketingStudio when key is absent",
  () => {
    const features = parsePlanFeatures({
      marketingStudio: true,
      aiMarketingGeneration: false,
    });

    assertEquals(features.marketingStudio, true);
    assertEquals(features.aiMarketingImageGeneration, true);
    assertEquals(features.aiMarketingVideoGeneration, false);
  },
);

Deno.test("parsePlanFeatures keeps aiMarketingImageGeneration false when explicitly set", () => {
  const features = parsePlanFeatures({
    marketingStudio: true,
    aiMarketingImageGeneration: false,
  });

  assertEquals(features.aiMarketingImageGeneration, false);
});

Deno.test(
  "parsePlanFeatures inherits aiMarketingVideoGeneration from aiMarketingGeneration when key is absent",
  () => {
    const features = parsePlanFeatures({
      marketingStudio: true,
      aiMarketingGeneration: true,
    });

    assertEquals(features.aiMarketingImageGeneration, true);
    assertEquals(features.aiMarketingVideoGeneration, true);
  },
);

Deno.test("parsePlanFeatures keeps aiMarketingVideoGeneration false when explicitly set", () => {
  const features = parsePlanFeatures({
    marketingStudio: true,
    aiMarketingGeneration: true,
    aiMarketingVideoGeneration: false,
  });

  assertEquals(features.aiMarketingVideoGeneration, false);
});

import {
  assert,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  DEFAULT_PLAN_FEATURES,
  isFeatureEnabled,
  mergePlanFeatures,
  type PlanFeatureKey,
} from "./planFeatures.ts";

Deno.test("parsePlanFeatures falls back to defaults for non-object input", () => {
  for (const raw of [null, undefined, "x", 3, true, [], [1, 2]]) {
    assertEquals(parsePlanFeatures(raw), DEFAULT_PLAN_FEATURES);
  }
});

Deno.test("parsePlanFeatures never lets a wrong-typed value through", () => {
  const parsed = parsePlanFeatures({
    smartPricing: "yes",
    calendarSync: 1,
    aiMonthlyCreditAllowance: "lots",
    marketingPublishLimitPerGroup: "many",
    searchVisibilityTier: "top1",
    teamManagement: { enabled: "true", maxMembers: "ten" },
  });
  assertEquals(parsed.smartPricing, false);
  assertEquals(parsed.calendarSync, false);
  assertEquals(parsed.aiMonthlyCreditAllowance, 0);
  assertEquals(parsed.marketingPublishLimitPerGroup, 0);
  assertEquals(parsed.searchVisibilityTier, "none");
  assertEquals(parsed.teamManagement, { enabled: false, maxMembers: null });
});

Deno.test("parsePlanFeatures maps legacy search tiers to the current ones", () => {
  assertEquals(
    parsePlanFeatures({ searchVisibilityTier: "top20" }).searchVisibilityTier,
    "top30",
  );
  assertEquals(
    parsePlanFeatures({ searchVisibilityTier: "top10" }).searchVisibilityTier,
    "top15",
  );
  assertEquals(
    parsePlanFeatures({ searchVisibilityTier: "top15" }).searchVisibilityTier,
    "top15",
  );
});

Deno.test("null maxMembers and null publish limit mean unlimited", () => {
  const parsed = parsePlanFeatures({
    teamManagement: { enabled: true, maxMembers: null },
    marketingPublishLimitPerGroup: null,
  });
  assertEquals(parsed.teamManagement, { enabled: true, maxMembers: null });
  assertEquals(parsed.marketingPublishLimitPerGroup, null);
  assert(isFeatureEnabled(parsed, "marketingPublishLimitPerGroup"));
  assert(isFeatureEnabled(parsed, "teamManagement"));
});

Deno.test("a row missing newer keys reads as not entitled for them", () => {
  const parsed = parsePlanFeatures({ automatedBookingFlow: true });
  for (
    const key of [
      "bookingImport",
      "customRoles",
      "calendarSync",
      "smartPricing",
      "analyticsInsights",
      "activityLogExport",
    ] as PlanFeatureKey[]
  ) {
    assertEquals(isFeatureEnabled(parsed, key), false, key);
  }
});

Deno.test("isFeatureEnabled treats zero allowances and none tier as off", () => {
  assertEquals(
    isFeatureEnabled({ ...DEFAULT_PLAN_FEATURES }, "aiMonthlyCreditAllowance"),
    false,
  );
  assertEquals(
    isFeatureEnabled({ ...DEFAULT_PLAN_FEATURES }, "searchVisibilityTier"),
    false,
  );
  assertEquals(
    isFeatureEnabled(
      { ...DEFAULT_PLAN_FEATURES },
      "marketingPublishLimitPerGroup",
    ),
    false,
  );
  assertEquals(
    isFeatureEnabled(
      { ...DEFAULT_PLAN_FEATURES, aiMonthlyCreditAllowance: 1 },
      "aiMonthlyCreditAllowance",
    ),
    true,
  );
  assertEquals(
    isFeatureEnabled({
      ...DEFAULT_PLAN_FEATURES,
      marketingPublishLimitPerGroup: 2,
    }, "marketingPublishLimitPerGroup"),
    true,
  );
  assertEquals(
    isFeatureEnabled({
      ...DEFAULT_PLAN_FEATURES,
      searchVisibilityTier: "top30",
    }, "searchVisibilityTier"),
    true,
  );
});

Deno.test("mergePlanFeatures applies per-subscription overrides and ignores junk", () => {
  const plan = parsePlanFeatures({
    smartPricing: false,
    teamManagement: { enabled: true, maxMembers: 3 },
  });
  const overridden = mergePlanFeatures(plan, { smartPricing: true });
  assertEquals(overridden.smartPricing, true);
  assertEquals(overridden.teamManagement, { enabled: true, maxMembers: 3 });
  assertEquals(mergePlanFeatures(plan, null), plan);
  assertEquals(
    mergePlanFeatures(plan, [] as unknown as Record<string, unknown>),
    plan,
  );
  assertNotEquals(overridden, plan);
});
