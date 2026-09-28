import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { summarizeAssistantFeedback } from './assistantFeedbackSummary.ts';

Deno.test('summarizeAssistantFeedback counts ratings and lists newest thumbs-down', () => {
  const summary = summarizeAssistantFeedback(
    [
      { rating: 1, reason: null, created_at: '2026-09-01T00:00:00Z', organization_id: 'o1' },
      {
        rating: -1,
        reason: 'wrong date',
        created_at: '2026-09-02T00:00:00Z',
        organization_id: 'o1',
      },
      { rating: -1, reason: null, created_at: '2026-09-03T00:00:00Z', organization_id: 'o2' },
      { rating: 1, reason: null, created_at: '2026-09-04T00:00:00Z', organization_id: 'o2' },
    ],
    (id) => (id === 'o1' ? 'Acme' : null)
  );
  assertEquals(summary.up, 2);
  assertEquals(summary.down, 2);
  assertEquals(summary.positivePct, 50);
  assertEquals(
    summary.recentNegative.map((r) => [r.createdAt.slice(0, 10), r.orgName]),
    [
      ['2026-09-03', null],
      ['2026-09-02', 'Acme'],
    ]
  );
});

Deno.test('summarizeAssistantFeedback handles no ratings', () => {
  assertEquals(
    summarizeAssistantFeedback([], () => null),
    {
      up: 0,
      down: 0,
      positivePct: null,
      recentNegative: [],
    }
  );
});
