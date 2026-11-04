import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { recentToolNamesFromMessages } from './toolHistory.ts';

Deno.test('collects tool names from assistant rows in order', () => {
  const names = recentToolNamesFromMessages([
    { role: 'user' },
    { role: 'assistant', latency_breakdown: { tools_ms: [{ name: 'list_bookings', ms: 10 }] } },
    { role: 'user' },
    {
      role: 'assistant',
      latency_breakdown: {
        tools_ms: [
          { name: 'get_booking', ms: 5 },
          { name: 'propose_transition_booking', ms: 7 },
        ],
      },
    },
  ]);
  assertEquals(names, ['list_bookings', 'get_booking', 'propose_transition_booking']);
});

Deno.test('ignores user rows, missing and malformed breakdowns', () => {
  assertEquals(
    recentToolNamesFromMessages([
      { role: 'user', latency_breakdown: { tools_ms: [{ name: 'x', ms: 1 }] } },
      { role: 'assistant' },
      { role: 'assistant', latency_breakdown: null },
      { role: 'assistant', latency_breakdown: 'bad' },
      { role: 'assistant', latency_breakdown: { tools_ms: 'nope' } },
      { role: 'assistant', latency_breakdown: { tools_ms: [null, { name: 3 }, { name: '  ' }] } },
    ]),
    []
  );
});

Deno.test('caps to the most recent names', () => {
  const tools = Array.from({ length: 20 }, (_, i) => ({ name: `t${i}`, ms: 1 }));
  const names = recentToolNamesFromMessages(
    [{ role: 'assistant', latency_breakdown: { tools_ms: tools } }],
    5
  );
  assertEquals(names, ['t15', 't16', 't17', 't18', 't19']);
});
