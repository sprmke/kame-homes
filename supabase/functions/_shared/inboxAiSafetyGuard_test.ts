import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  AI_SUGGEST_FALLBACK_REPLY,
  assertSafeGuestReply,
  classifyGuestInquiryIntent,
} from './inboxAiSafetyGuard.ts';

Deno.test('classifyGuestInquiryIntent — sensitive guest list request', () => {
  assertEquals(
    classifyGuestInquiryIntent('Who else is staying at the property this week?'),
    'sensitive'
  );
});

Deno.test('classifyGuestInquiryIntent — normal pricing question', () => {
  assertEquals(classifyGuestInquiryIntent('What is the rate for tonight?'), 'normal');
});

Deno.test('assertSafeGuestReply — blocks other guest names', () => {
  const result = assertSafeGuestReply({
    draftText: 'James Lim is also checked in on your dates.',
    guestMessage: 'Is parking included?',
    allowedFacts: { pricingValues: [] },
    participantName: 'Maria Santos',
    otherGuestNames: ['James Lim'],
  });
  assertEquals(result.safe, false);
  if (!result.safe) {
    assert(result.reason.includes('James Lim'));
  }
});

Deno.test('assertSafeGuestReply — allows grounded pricing amount', () => {
  const result = assertSafeGuestReply({
    draftText: 'The nightly rate is ₱3,500.',
    guestMessage: 'How much per night?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(result.safe, true);
});

Deno.test('assertSafeGuestReply — blocks ungrounded pricing', () => {
  const result = assertSafeGuestReply({
    draftText: 'The nightly rate is ₱9,999.',
    guestMessage: 'How much per night?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(result.safe, false);
});

Deno.test('assertSafeGuestReply — sensitive inquiry with refusal is safe', () => {
  const result = assertSafeGuestReply({
    draftText: "I can't share other guest details for privacy. I'll check with the host team.",
    guestMessage: 'Who else booked this weekend?',
    allowedFacts: { pricingValues: [] },
  });
  assertEquals(result.safe, true);
});

Deno.test('AI_SUGGEST_FALLBACK_REPLY is non-empty', () => {
  assert(AI_SUGGEST_FALLBACK_REPLY.trim().length > 0);
});

Deno.test('assertSafeGuestReply — blocks an invented GCash / bank number', () => {
  const result = assertSafeGuestReply({
    draftText: 'Please send the down payment to GCash 0917 123 4567.',
    guestMessage: 'How do I pay?',
    allowedFacts: { pricingValues: [], allowedAccountNumbers: ['09998887777'] },
  });
  assertEquals(result.safe, false);
});

Deno.test('assertSafeGuestReply — allows the configured payment account number', () => {
  const result = assertSafeGuestReply({
    draftText: 'You can pay via GCash 0999-888-7777 (Juan D.).',
    guestMessage: 'How do I pay?',
    allowedFacts: { pricingValues: [], allowedAccountNumbers: ['09998887777'] },
  });
  assertEquals(result.safe, true);
});

Deno.test('assertSafeGuestReply — allows numbers present in the grounded facts (host phone)', () => {
  const result = assertSafeGuestReply({
    draftText: 'You can reach the host at +63 917 555 0101.',
    guestMessage: 'What is your number?',
    allowedFacts: { pricingValues: [], factsText: 'Host contact: +63 917 555 0101' },
  });
  assertEquals(result.safe, true);
});

Deno.test('assertSafeGuestReply — checks amounts written without a currency sign', () => {
  const ungrounded = assertSafeGuestReply({
    draftText: 'The rate is 9,999 per night.',
    guestMessage: 'What is the rate?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(ungrounded.safe, false);
  const grounded = assertSafeGuestReply({
    draftText: 'The rate is 3,500 pesos per night.',
    guestMessage: 'What is the rate?',
    allowedFacts: { pricingValues: [3500] },
  });
  assertEquals(grounded.safe, true);
});
