/**
 * Cancellation policy engine — legacy mapping, presets, validation, rendering.
 * Run: deno test --allow-env --allow-net supabase/functions/_shared/cancellationPolicy_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildCancellationPolicySnapshot,
  buildCancellationPreset,
  cancellationPolicyHash,
  isCancellationPolicyNonRefundable,
  normalizeCancellationPolicy,
  readCancellationPolicySnapshot,
  resolveCancellationPolicyDisplay,
  validateCancellationPolicy,
} from './cancellationPolicy.ts';

Deno.test('missing policy resolves to unset, never a silent default', () => {
  assertEquals(normalizeCancellationPolicy(undefined), null);
  assertEquals(normalizeCancellationPolicy({}), null);
  const display = resolveCancellationPolicyDisplay(null);
  assertEquals(display.unset, true);
  assertEquals(display.title, 'Ask the host about cancellation');
});

Deno.test('legacy grace_period maps to Flexible', () => {
  const policy = normalizeCancellationPolicy({ type: 'grace_period', gracePeriodHours: 48 });
  assert(policy);
  assertEquals(policy.presetId, 'flexible');
  assertEquals(policy.tiers, [{ daysBefore: 1, refundPercent: 100 }]);
});

Deno.test('legacy full_before_checkin maps to a 100% tier', () => {
  const policy = normalizeCancellationPolicy({ type: 'full_before_checkin', daysBeforeCheckIn: 7 });
  assert(policy);
  assertEquals(policy.tiers, [{ daysBefore: 7, refundPercent: 100 }]);
});

Deno.test('legacy moderate keeps the deadline tier', () => {
  const policy = normalizeCancellationPolicy({
    type: 'moderate',
    gracePeriodHours: 72,
    daysBeforeCheckIn: 5,
  });
  assert(policy);
  assertEquals(policy.tiers, [{ daysBefore: 5, refundPercent: 100 }]);
});

Deno.test('legacy partial maps to a percent tier', () => {
  const policy = normalizeCancellationPolicy({
    type: 'partial_before_checkin',
    daysBeforeCheckIn: 14,
    partialRefundPercent: 50,
  });
  assert(policy);
  assertEquals(policy.tiers, [{ daysBefore: 14, refundPercent: 50 }]);
});

Deno.test('legacy free text becomes needsReview with preserved copy', () => {
  const policy = normalizeCancellationPolicy({
    type: 'custom',
    customTitle: 'Ask us',
    customDescription: 'Message us for terms.',
  });
  assert(policy);
  assertEquals(policy.needsReview, true);
  assertEquals(policy.legacyDescription, 'Message us for terms.');
  assertEquals(policy.legacyTitle, 'Ask us');
  assertEquals(validateCancellationPolicy(policy), null);
});

Deno.test('presets carry the documented schedule', () => {
  assertEquals(buildCancellationPreset('moderate').tiers, [
    { daysBefore: 3, refundPercent: 100 },
  ]);
  assertEquals(buildCancellationPreset('standard').tiers, [
    { daysBefore: 5, refundPercent: 100 },
  ]);
  assertEquals(buildCancellationPreset('limited').tiers, [
    { daysBefore: 7, refundPercent: 100 },
  ]);
  const firm = buildCancellationPreset('firm');
  assertEquals(firm.tiers, [
    { daysBefore: 14, refundPercent: 100 },
    { daysBefore: 7, refundPercent: 50 },
  ]);
  assertEquals(firm.fallbackRefundPercent, 0);

  const nonRefundable = buildCancellationPreset('non_refundable');
  assertEquals(nonRefundable.tiers, []);
});

Deno.test('custom tiers are sorted, deduped and capped at five', () => {
  const policy = normalizeCancellationPolicy({
    version: 2,
    presetId: 'custom',
    tiers: [
      { daysBefore: 7, refundPercent: 50 },
      { daysBefore: 30, refundPercent: 100 },
      { daysBefore: 30, refundPercent: 75 },
      { daysBefore: 1, refundPercent: 25 },
      { daysBefore: 3, refundPercent: 40 },
      { daysBefore: 2, refundPercent: 30 },
      { daysBefore: 0, refundPercent: 0 },
    ],
  });
  assert(policy);
  assertEquals(policy.tiers.length, 5);
  assertEquals(policy.tiers[0], { daysBefore: 30, refundPercent: 75 });
  assertEquals(policy.tiers.map((tier) => tier.daysBefore), [30, 7, 3, 2, 1]);
});

Deno.test('validation rejects increasing refunds and a too-high fallback', () => {
  const increasing = buildCancellationPreset('custom', {
    tiers: [
      { daysBefore: 14, refundPercent: 50 },
      { daysBefore: 7, refundPercent: 100 },
    ],
  });
  assertEquals(
    validateCancellationPolicy(increasing),
    'Refund percent cannot increase closer to check-in'
  );

  const fallbackTooHigh = {
    version: 2,
    presetId: 'custom',
    tiers: [{ daysBefore: 7, refundPercent: 50 }],
    fallbackRefundPercent: 75,
  };
  assertEquals(
    validateCancellationPolicy(fallbackTooHigh),
    'The fallback refund cannot be higher than the closest deadline'
  );
});

Deno.test('validation rejects an empty custom policy', () => {
  const empty = buildCancellationPreset('custom', { tiers: [] });
  assertEquals(validateCancellationPolicy(empty), 'Add at least one refund deadline');
});

Deno.test('rendering shows the timeline for a custom policy', () => {
  const display = resolveCancellationPolicyDisplay(
    buildCancellationPreset('custom', {
      tiers: [
        { daysBefore: 14, refundPercent: 100 },
        { daysBefore: 7, refundPercent: 50 },
      ],
    })
  );
  assertEquals(display.timeline.length, 2);
  assertEquals(display.timeline[0].refundPercent, 100);
  assertEquals(display.showListingHighlight, true);
  assertEquals(display.description.includes('of what you paid'), true);
});

Deno.test('snapshot round-trips and hashes deterministically', () => {
  const policy = buildCancellationPreset('moderate');
  const snapshot = buildCancellationPolicySnapshot({
    policy,
    capturedFrom: 'guest_form',
    propertyPolicyVersionId: 'version-1',
    capturedAt: '2026-11-05T00:00:00.000Z',
  });
  assertEquals(snapshot.hash, cancellationPolicyHash(policy));
  assertEquals(snapshot.unset, undefined);
  const parsed = readCancellationPolicySnapshot(snapshot);
  assert(parsed);
  assertEquals(parsed.policy?.presetId, 'moderate');
  assertEquals(parsed.rendered.title, 'Moderate');
  assertEquals(parsed.capturedFrom, 'guest_form');
});

Deno.test('unset snapshot carries the unset marker', () => {
  const snapshot = buildCancellationPolicySnapshot({
    policy: null,
    capturedFrom: 'import',
    capturedAt: '2026-11-05T00:00:00.000Z',
  });
  assertEquals(snapshot.unset, true);
  assertEquals(snapshot.policy, null);
});

Deno.test('detects non-refundable presets and custom 0% schedules', () => {
  assertEquals(
    isCancellationPolicyNonRefundable(
      resolveCancellationPolicyDisplay(buildCancellationPreset('non_refundable'))
    ),
    true
  );
  assertEquals(
    isCancellationPolicyNonRefundable(
      resolveCancellationPolicyDisplay(
        buildCancellationPreset('custom', {
          tiers: [
            { daysBefore: 14, refundPercent: 0 },
            { daysBefore: 7, refundPercent: 0 },
          ],
        })
      )
    ),
    true
  );
  assertEquals(
    isCancellationPolicyNonRefundable(
      resolveCancellationPolicyDisplay(buildCancellationPreset('moderate'))
    ),
    false
  );
});
