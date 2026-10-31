import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { MANAGED_PLAN_CODE, validateOrgPlanDowngradeRequest } from '../_shared/orgPlanDowngrade.ts';

const base = {
  currentPlanId: 'pro-id',
  currentPlanCode: 'pro',
  currentPlanSortOrder: 30,
  currentPlanIsDefault: false,
  subscriptionStatus: 'active',
  targetPlanId: 'starter-id',
  targetPlanCode: 'starter',
  targetPlanSortOrder: 10,
  targetPlanIsDefault: false,
};

Deno.test('allows active paid to lower paid downgrade', () => {
  const result = validateOrgPlanDowngradeRequest(base);
  assertEquals(result, { ok: true, toFree: false });
});

Deno.test('allows active paid to Free downgrade', () => {
  const result = validateOrgPlanDowngradeRequest({
    ...base,
    targetPlanId: 'free-id',
    targetPlanCode: 'free',
    targetPlanSortOrder: 0,
    targetPlanIsDefault: true,
  });
  assertEquals(result, { ok: true, toFree: true });
});

Deno.test('blocks past_due downgrades', () => {
  const result = validateOrgPlanDowngradeRequest({
    ...base,
    subscriptionStatus: 'past_due',
  });
  assertEquals(result.ok, false);
});

Deno.test('allows suspended to Free only', () => {
  const toFree = validateOrgPlanDowngradeRequest({
    ...base,
    subscriptionStatus: 'suspended',
    targetPlanId: 'free-id',
    targetPlanCode: 'free',
    targetPlanSortOrder: 0,
    targetPlanIsDefault: true,
  });
  assertEquals(toFree, { ok: true, toFree: true });

  const toPaid = validateOrgPlanDowngradeRequest({
    ...base,
    subscriptionStatus: 'suspended',
  });
  assertEquals(toPaid.ok, false);
});

Deno.test('blocks Managed current and target', () => {
  const fromManaged = validateOrgPlanDowngradeRequest({
    ...base,
    currentPlanCode: MANAGED_PLAN_CODE,
    currentPlanSortOrder: 50,
  });
  assertEquals(fromManaged.ok, false);

  const toManaged = validateOrgPlanDowngradeRequest({
    ...base,
    targetPlanId: 'managed-id',
    targetPlanCode: MANAGED_PLAN_CODE,
    targetPlanSortOrder: 50,
  });
  assertEquals(toManaged.ok, false);
});

Deno.test('rejects upgrades and same tier', () => {
  const upgrade = validateOrgPlanDowngradeRequest({
    ...base,
    targetPlanId: 'business-id',
    targetPlanCode: 'growth',
    targetPlanSortOrder: 40,
  });
  assertEquals(upgrade.ok, false);

  const same = validateOrgPlanDowngradeRequest({
    ...base,
    targetPlanId: base.currentPlanId,
    targetPlanCode: base.currentPlanCode,
    targetPlanSortOrder: base.currentPlanSortOrder,
  });
  assertEquals(same.ok, false);
});
