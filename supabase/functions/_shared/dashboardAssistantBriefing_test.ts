import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { BRIEFING_CARD_MAX, buildBriefingCards } from './dashboardAssistantBriefing.ts';
import type { DashboardAttentionItem } from './dashboardService.ts';

const item = (
  id: string,
  severity: DashboardAttentionItem['severity'],
  count = 2
): DashboardAttentionItem => ({ id, label: id, count, href: `/bookings?x=${id}`, severity });

Deno.test('buildBriefingCards orders by severity and keeps source order within a tier', () => {
  const cards = buildBriefingCards([
    item('unpaid-balance', 'info'),
    item('pending-documents', 'warning'),
    item('pending-review', 'critical'),
    item('check-ins-today', 'critical'),
  ]);
  assertEquals(
    cards.map((card) => card.id),
    ['pending-review', 'check-ins-today', 'pending-documents', 'unpaid-balance']
  );
  assertEquals(
    cards[0].prompt,
    'Which bookings are waiting for my review, and what does each one need?'
  );
});

Deno.test('buildBriefingCards drops zero counts, caps the list and falls back on prompts', () => {
  const many = Array.from({ length: 9 }, (_, i) => item(`custom-${i}`, 'info'));
  const cards = buildBriefingCards([item('pending-review', 'critical', 0), ...many]);
  assertEquals(cards.length, BRIEFING_CARD_MAX);
  assertEquals(cards[0].id, 'custom-0');
  assertEquals(cards[0].prompt, 'Tell me about: custom-0');
});
