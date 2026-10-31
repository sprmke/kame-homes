import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  averageToolsSent,
  evalCaseModule,
  mapEvalRunRow,
  summarizeEvalByModule,
} from './assistantEvalSummary.ts';

Deno.test('evalCaseModule prefers the row module, then the expected tool, then safety', () => {
  assertEquals(evalCaseModule({ module: 'pricing', expectToolsAny: ['list_bookings'] }), 'pricing');
  assertEquals(
    evalCaseModule({ expectToolsAny: ['unknown_tool', 'get_finance_summary'] }),
    'finance'
  );
  assertEquals(evalCaseModule({}), 'safety');
});

Deno.test('summarizeEvalByModule groups cases and lists the weakest module first', () => {
  const scores = summarizeEvalByModule([
    { pass: true, expectToolsAny: ['list_bookings'] },
    { pass: false, expectToolsAny: ['get_booking'] },
    { pass: true, expectToolsAny: ['get_finance_summary'] },
    { pass: true },
  ]);
  assertEquals(scores, [
    { module: 'bookings', passed: 1, total: 2 },
    { module: 'finance', passed: 1, total: 1 },
    { module: 'safety', passed: 1, total: 1 },
  ]);
});

Deno.test('averageToolsSent ignores cases without a count', () => {
  assertEquals(
    averageToolsSent([
      { pass: true, toolsSent: 20 },
      { pass: true, toolsSent: 25 },
      { pass: true },
    ]),
    22.5
  );
  assertEquals(averageToolsSent([{ pass: true }]), null);
});

Deno.test('mapEvalRunRow drops malformed module entries', () => {
  const run = mapEvalRunRow({
    id: 'r1',
    created_at: '2026-09-28T00:00:00Z',
    routed: true,
    passed: 3,
    total: 4,
    avg_tools_sent: '31.5',
    prompt_version: '2026-09-28.1',
    modules: [{ module: 'finance', passed: 1, total: 1 }, { module: 7 }, null],
  });
  assertEquals(run.avgToolsSent, 31.5);
  assertEquals(run.modules, [{ module: 'finance', passed: 1, total: 1 }]);
});
