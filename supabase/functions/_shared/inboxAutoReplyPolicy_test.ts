import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { AI_SUGGEST_FALLBACK_REPLY } from './inboxAiSafetyGuard.ts';
import { isSendableAutoReply, isWithinAutoReplyCooldown } from './inboxAutoReplyPolicy.ts';

const NOW = Date.parse('2026-09-24T10:00:00Z');
const at = (secondsAgo: number) => new Date(NOW - secondsAgo * 1000).toISOString();

Deno.test('isSendableAutoReply — a guard-flagged fallback is never auto-sent', () => {
  assertEquals(
    isSendableAutoReply({ suggestion: AI_SUGGEST_FALLBACK_REPLY, flagged: true }),
    false
  );
});

Deno.test('isSendableAutoReply — empty drafts are not sent', () => {
  assertEquals(isSendableAutoReply({ suggestion: '   ', flagged: false }), false);
});

Deno.test('isSendableAutoReply — a clean draft is sent', () => {
  assertEquals(isSendableAutoReply({ suggestion: 'Check-in is at 2 PM.', flagged: false }), true);
});

Deno.test('isWithinAutoReplyCooldown — recent AI reply with no newer guest message', () => {
  const messages = [
    { id: '1', direction: 'inbound', sent_at: at(60) },
    { id: '2', direction: 'outbound', is_ai_generated: true, sent_at: at(30) },
  ];
  assertEquals(isWithinAutoReplyCooldown(messages, NOW), true);
});

Deno.test('isWithinAutoReplyCooldown — a new guest message after the AI reply reopens it', () => {
  const messages = [
    { id: '1', direction: 'outbound', is_ai_generated: true, sent_at: at(30) },
    { id: '2', direction: 'inbound', sent_at: at(10) },
  ];
  assertEquals(isWithinAutoReplyCooldown(messages, NOW), false);
});

Deno.test('isWithinAutoReplyCooldown — old AI replies and host replies do not block', () => {
  const messages = [
    { id: '1', direction: 'outbound', is_ai_generated: true, sent_at: at(600) },
    { id: '2', direction: 'outbound', is_ai_generated: false, sent_at: at(5) },
  ];
  assertEquals(isWithinAutoReplyCooldown(messages, NOW), false);
});
