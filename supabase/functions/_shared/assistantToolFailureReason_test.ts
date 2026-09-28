import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  DEFAULT_TOOL_FAILURE_REASON,
  hostFacingToolFailureReason,
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

Deno.test('memory refusals get their own plain reason', () => {
  assertEquals(hostFacingToolFailureReason('That is already saved.'), 'That is already saved.');
  assertEquals(
    hostFacingToolFailureReason('You can keep up to 20. Remove one first.'),
    'Memory is full. Remove one first.'
  );
  assertEquals(
    hostFacingToolFailureReason(
      'That instruction cannot be saved. Confirmation and safety rules always apply.'
    ),
    "That instruction can't be saved."
  );
  assertEquals(
    hostFacingToolFailureReason('Keep it under 300 characters'),
    'That is too long to save.'
  );
});
