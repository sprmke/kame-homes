import {
  assertEquals,
  assertInstanceOf,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  catchPlanFeatureError,
  PlanFeatureRequiredError,
} from "../_shared/planEntitlements.ts";
import { subscriptionStatusBlocksFeatureGates } from "../_shared/orgPlanDowngrade.ts";

const req = new Request("https://example.test/fn", { method: "POST" });

Deno.test("PlanFeatureRequiredError carries the feature key and a default message", () => {
  const err = new PlanFeatureRequiredError("smartPricing");
  assertEquals(err.feature, "smartPricing");
  assertEquals(err.upgradeHook, true);
  assertEquals(err.name, "PlanFeatureRequiredError");
  assertEquals(err.message.includes("smartPricing"), true);
});

Deno.test("catchPlanFeatureError maps the error to the upgradeHook envelope the UI expects", async () => {
  const res = catchPlanFeatureError(
    req,
    new PlanFeatureRequiredError("calendarSync"),
  );
  assertInstanceOf(res, Response);
  const body = await res!.json();
  assertEquals(body.success, false);
  assertEquals(body.upgradeHook, true);
  assertEquals(body.feature, "calendarSync");
  assertEquals(res!.status, 429);
});

Deno.test("catchPlanFeatureError keeps a custom (suspended) message", async () => {
  const message =
    "Subscription suspended — pay from Plans & Billing to restore access";
  const res = catchPlanFeatureError(
    req,
    new PlanFeatureRequiredError("financeReporting", message),
  );
  const body = await res!.json();
  assertEquals(body.error, message);
});

Deno.test("catchPlanFeatureError ignores other errors so handlers rethrow them", () => {
  assertEquals(catchPlanFeatureError(req, new Error("boom")), null);
  assertEquals(catchPlanFeatureError(req, "x"), null);
  assertEquals(catchPlanFeatureError(req, null), null);
});

Deno.test("only a suspended subscription blocks paid feature gates (all tiers behave the same)", () => {
  for (
    const status of ["active", "trialing", "past_due", "canceled", "unknown"]
  ) {
    assertEquals(subscriptionStatusBlocksFeatureGates(status), false, status);
  }
  assertEquals(subscriptionStatusBlocksFeatureGates("suspended"), true);
});
