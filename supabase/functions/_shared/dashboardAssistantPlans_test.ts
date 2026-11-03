import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  capPlanSteps,
  derivePlanStatus,
  findStepDependencies,
  PLAN_STEP_CAP,
  resolveStepPlaceholders,
  stepsToSkipForFailure,
} from './dashboardAssistantPlans.ts';

Deno.test('findStepDependencies — no placeholders means no dependencies', () => {
  assertEquals(findStepDependencies({ bookingId: 'abc', toStatus: 'READY_FOR_CHECKIN' }), []);
});

Deno.test('findStepDependencies — finds a single top-level placeholder', () => {
  assertEquals(findStepDependencies({ bookingId: '{{step1.bookingId}}' }), [1]);
});

Deno.test(
  'findStepDependencies — finds nested placeholders in arrays/objects, deduped and sorted',
  () => {
    const payload = {
      bookingId: '{{step2.id}}',
      nested: { ref: '{{step1.bookingId}}' },
      list: ['plain', '{{step2.id}}', '{{step0.x}}'],
    };
    assertEquals(findStepDependencies(payload), [0, 1, 2]);
  }
);

Deno.test(
  'resolveStepPlaceholders — whole-string placeholder resolves to the real value type',
  () => {
    const prior = new Map<number, unknown>([[1, { bookingId: 'book-123', amount: 500 }]]);
    const resolved = resolveStepPlaceholders(
      { bookingId: '{{step1.bookingId}}', amount: '{{step1.amount}}' },
      prior
    );
    assertEquals(resolved.bookingId, 'book-123');
    assertEquals(resolved.amount, 500);
  }
);

Deno.test('resolveStepPlaceholders — nested path lookup', () => {
  const prior = new Map<number, unknown>([[0, { data: { booking: { id: 'nested-id' } } }]]);
  const resolved = resolveStepPlaceholders({ bookingId: '{{step0.data.booking.id}}' }, prior);
  assertEquals(resolved.bookingId, 'nested-id');
});

Deno.test(
  'resolveStepPlaceholders — embedded placeholder in a larger string is stringified in place',
  () => {
    const prior = new Map<number, unknown>([[1, { bookingId: 'XYZ' }]]);
    const resolved = resolveStepPlaceholders(
      { note: 'For booking {{step1.bookingId}} only' },
      prior
    );
    assertEquals(resolved.note, 'For booking XYZ only');
  }
);

Deno.test(
  'resolveStepPlaceholders — missing step or missing path leaves the token untouched',
  () => {
    const prior = new Map<number, unknown>([[1, { bookingId: 'XYZ' }]]);
    const resolved = resolveStepPlaceholders(
      { a: '{{step9.bookingId}}', b: '{{step1.missingField}}' },
      prior
    );
    assertEquals(resolved.a, '{{step9.bookingId}}');
    assertEquals(resolved.b, '{{step1.missingField}}');
  }
);

Deno.test('resolveStepPlaceholders — resolves nested objects and arrays recursively', () => {
  const prior = new Map<number, unknown>([[0, { id: 'A1' }]]);
  const resolved = resolveStepPlaceholders(
    { payload: { bookingId: '{{step0.id}}' }, tags: ['{{step0.id}}', 'static'] },
    prior
  );
  assertEquals(resolved, { payload: { bookingId: 'A1' }, tags: ['A1', 'static'] });
});

Deno.test('capPlanSteps — keeps the list unmodified under the cap', () => {
  const steps = [1, 2, 3];
  const { kept, overflow } = capPlanSteps(steps, 10);
  assertEquals(kept, steps);
  assertEquals(overflow, 0);
});

Deno.test('capPlanSteps — truncates at the cap and reports overflow', () => {
  const steps = Array.from({ length: 15 }, (_, i) => i);
  const { kept, overflow } = capPlanSteps(steps, PLAN_STEP_CAP);
  assertEquals(kept.length, PLAN_STEP_CAP);
  assertEquals(overflow, 5);
  assertEquals(kept[kept.length - 1], PLAN_STEP_CAP - 1);
});

Deno.test('stepsToSkipForFailure — a step depending on a failed step is skipped', () => {
  const steps = [
    { stepIndex: 0, dependsOn: [] },
    { stepIndex: 1, dependsOn: [0] },
    { stepIndex: 2, dependsOn: [] },
  ];
  const skip = stepsToSkipForFailure(steps, new Set([0]));
  assertEquals([...skip].sort(), [1]);
});

Deno.test('stepsToSkipForFailure — propagates transitively through a chain', () => {
  const steps = [
    { stepIndex: 0, dependsOn: [] },
    { stepIndex: 1, dependsOn: [0] },
    { stepIndex: 2, dependsOn: [1] },
    { stepIndex: 3, dependsOn: [] },
  ];
  const skip = stepsToSkipForFailure(steps, new Set([0]));
  assertEquals([...skip].sort(), [1, 2]);
});

Deno.test('stepsToSkipForFailure — an independent step is never skipped', () => {
  const steps = [
    { stepIndex: 0, dependsOn: [] },
    { stepIndex: 1, dependsOn: [] },
  ];
  const skip = stepsToSkipForFailure(steps, new Set([0]));
  assertEquals(skip.size, 0);
});

Deno.test('derivePlanStatus — cancelled when nothing was selected', () => {
  assertEquals(derivePlanStatus([{ selected: false, status: 'proposed' }]), 'cancelled');
});

Deno.test('derivePlanStatus — completed when every selected step executed', () => {
  assertEquals(
    derivePlanStatus([
      { selected: true, status: 'executed' },
      { selected: true, status: 'executed' },
      { selected: false, status: 'proposed' },
    ]),
    'completed'
  );
});

Deno.test('derivePlanStatus — partially_failed on a mixed outcome', () => {
  assertEquals(
    derivePlanStatus([
      { selected: true, status: 'executed' },
      { selected: true, status: 'failed' },
    ]),
    'partially_failed'
  );
});

Deno.test('derivePlanStatus — partially_failed when every selected step failed', () => {
  assertEquals(
    derivePlanStatus([
      { selected: true, status: 'failed' },
      { selected: true, status: 'failed' },
    ]),
    'partially_failed'
  );
});
