import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  classifyToolFailure,
  DEFAULT_TOOL_FAILURE_REASON,
  hostFacingToolFailureReason,
  modelFacingToolFailureHint,
} from './assistantToolFailureReason.ts';

Deno.test('portfolio-scope finance call explains the one-listing limit', () => {
  assertStringIncludes(
    hostFacingToolFailureReason('propertyId is required (no property in scope)'),
    'one listing'
  );
});

Deno.test('permission refusals map to a role message', () => {
  assertStringIncludes(hostFacingToolFailureReason('Access restricted for this action.'), 'role');
});

Deno.test('raw internal errors never pass through', () => {
  const raw = 'column guest_submissions.foo does not exist at character 42';
  const reason = hostFacingToolFailureReason(raw);
  assertEquals(reason.includes('guest_submissions'), false);
  assertEquals(hostFacingToolFailureReason('boom 0x7f'), DEFAULT_TOOL_FAILURE_REASON);
  assertEquals(hostFacingToolFailureReason(undefined), DEFAULT_TOOL_FAILURE_REASON);
});

Deno.test('explanation text is not mistaken for a plan gate', () => {
  assertEquals(
    hostFacingToolFailureReason('Missing explanation field'),
    DEFAULT_TOOL_FAILURE_REASON
  );
});

Deno.test('classifyToolFailure buckets common failures', () => {
  assertEquals(
    classifyToolFailure('propertyId is required (no property in scope)'),
    'scope_missing'
  );
  assertEquals(classifyToolFailure('Access restricted for this action.'), 'permission_denied');
  assertEquals(classifyToolFailure('Not included in your plan'), 'plan_denied');
  assertEquals(classifyToolFailure('Booking not found'), 'not_found');
  assertEquals(classifyToolFailure('request timed out'), 'retryable');
  assertEquals(classifyToolFailure('amount is required'), 'invalid_arguments');
  assertEquals(classifyToolFailure('boom 0x7f'), 'unknown');
});

Deno.test('modelFacingToolFailureHint gives a distinct instruction per class, never empty', () => {
  const classes = [
    'scope_missing',
    'permission_denied',
    'plan_denied',
    'not_found',
    'retryable',
    'invalid_arguments',
    'unknown',
  ] as const;
  const hints = new Set<string>();
  for (const failureClass of classes) {
    const hint = modelFacingToolFailureHint(failureClass);
    assertStringIncludes(hint, 'retry');
    hints.add(hint);
  }
  assertEquals(hints.size, classes.length);
});
