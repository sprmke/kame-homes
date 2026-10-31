import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { subscriptionStatusBlocksFeatureGates } from '../_shared/orgPlanDowngrade.ts';

Deno.test('subscriptionStatusBlocksFeatureGates blocks suspended only', () => {
  assertEquals(subscriptionStatusBlocksFeatureGates('suspended'), true);
  assertEquals(subscriptionStatusBlocksFeatureGates('active'), false);
  assertEquals(subscriptionStatusBlocksFeatureGates('trialing'), false);
  assertEquals(subscriptionStatusBlocksFeatureGates('past_due'), false);
});
