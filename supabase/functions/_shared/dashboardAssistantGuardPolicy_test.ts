import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { shouldRunLlmGuard, type GuardPolicyInput } from './dashboardAssistantGuardPolicy.ts';

const clean: GuardPolicyInput = {
  untrustedContentRead: false,
  hasProposal: false,
  hasDeferredWrites: false,
  hasExecutedWrites: false,
  quickScanFailed: false,
  groundingRejected: false,
  answerText: 'Check-in is 2 PM. Two bookings are waiting.',
  groundingText: 'check-in 2 PM. two bookings waiting.',
};

Deno.test('shouldRunLlmGuard is deterministic on a clean read-only turn', () => {
  assertEquals(shouldRunLlmGuard(clean), false);
});

Deno.test('shouldRunLlmGuard runs the LLM on every risky branch', () => {
  const branches: Array<keyof GuardPolicyInput> = [
    'untrustedContentRead',
    'hasProposal',
    'hasDeferredWrites',
    'hasExecutedWrites',
    'quickScanFailed',
    'groundingRejected',
  ];
  for (const key of branches) {
    assertEquals(shouldRunLlmGuard({ ...clean, [key]: true }), true, key);
  }
});

Deno.test('shouldRunLlmGuard runs the LLM when the answer introduces a URL or email', () => {
  assertEquals(
    shouldRunLlmGuard({
      ...clean,
      answerText: 'See https://evil.example/leak',
      groundingText: 'check-in 2 PM',
    }),
    true
  );
  assertEquals(
    shouldRunLlmGuard({
      ...clean,
      answerText: 'Email ana@example.test',
      groundingText: 'check-in 2 PM',
    }),
    true
  );
});

Deno.test('shouldRunLlmGuard allows amounts already in the grounding text', () => {
  assertEquals(
    shouldRunLlmGuard({
      ...clean,
      answerText: 'Revenue is ₱12,500.',
      groundingText: 'total revenue 12500',
    }),
    false
  );
});
