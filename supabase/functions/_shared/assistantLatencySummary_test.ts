import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { summarizeAssistantLatency } from './assistantLatencySummary.ts';

const row = (
  dimension: string,
  key: string,
  turns: number,
  p50: number | null,
  p95: number | null
) => ({
  dimension,
  key,
  turns: String(turns),
  total_p50_ms: p50,
  total_p95_ms: p95,
  model_p50_ms: p50 == null ? null : Math.round(p50 / 2),
  tools_p50_ms: 120,
  synth_p50_ms: null,
  guard_p50_ms: '400' as unknown as number,
});

Deno.test(
  'summarizeAssistantLatency splits dimensions, coerces bigint strings and sorts by turns',
  () => {
    const summary = summarizeAssistantLatency([
      row('module', 'bookings', 4, 3800, 7900),
      row('module', 'finance', 9, 5200, 11000),
      row('guard_mode', 'llm', 10, 5000, 10000),
      row('guard_mode', 'deterministic', 3, 2600, 4100),
      row('other', 'ignored', 99, 1, 1),
      row('module', '', 2, 1, 1),
    ]);
    assertEquals(summary.turns, 13);
    assertEquals(
      summary.byModule.map((b) => b.key),
      ['finance', 'bookings']
    );
    assertEquals(summary.byModule[1], {
      key: 'bookings',
      turns: 4,
      p50Ms: 3800,
      p95Ms: 7900,
      modelP50Ms: 1900,
      toolsP50Ms: 120,
      synthP50Ms: null,
      guardP50Ms: 400,
    });
    assertEquals(
      summary.byGuardMode.map((b) => b.key),
      ['llm', 'deterministic']
    );
  }
);

Deno.test('summarizeAssistantLatency on no rows is empty, not an error', () => {
  assertEquals(summarizeAssistantLatency([]), { turns: 0, byModule: [], byGuardMode: [] });
});
