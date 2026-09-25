import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  boundToolResult,
  estimateHistoryTokens,
  fitHistoryToTokenBudget,
} from './contextBudget.ts';
import type { GeminiContent } from './llmTools.ts';

Deno.test('boundToolResult returns small results unchanged', () => {
  const value = { bookings: [{ id: 'b1' }], total: 1 };
  assertEquals(boundToolResult(value, 1000), value);
});

Deno.test('boundToolResult trims long lists and keeps structure', () => {
  const value = {
    total: 500,
    bookings: Array.from({ length: 500 }, (_, i) => ({ id: `b${i}`, guest: 'Guest name' })),
  };
  const bounded = boundToolResult(value, 2000) as { total: number; bookings: unknown[] };
  assert(JSON.stringify(bounded).length <= 2000);
  assertEquals(bounded.total, 500);
  const marker = bounded.bookings.at(-1) as { _truncated: string };
  assert(marker._truncated.includes('more items omitted'));
});

Deno.test('boundToolResult falls back to a clipped preview', () => {
  const bounded = boundToolResult({ text: 'x'.repeat(5000) }, 200) as Record<string, string>;
  assert(JSON.stringify(bounded).length <= 400);
});

Deno.test(
  'fitHistoryToTokenBudget drops oldest turns and never starts on a function response',
  () => {
    const big = 'y'.repeat(4000);
    const history: GeminiContent[] = [
      { role: 'user', parts: [{ text: big }] },
      { role: 'model', parts: [{ text: big }] },
      { role: 'user', parts: [{ text: 'recent question' }] },
      { role: 'model', parts: [{ functionCall: { name: 'list_bookings', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'list_bookings', response: {} } }] },
      { role: 'model', parts: [{ text: 'recent answer' }] },
    ];
    const fitted = fitHistoryToTokenBudget(history, 200);
    assertEquals(fitted[0], history[2]);
    assert(estimateHistoryTokens(fitted) <= 200);
  }
);

Deno.test('fitHistoryToTokenBudget keeps everything under budget', () => {
  const history: GeminiContent[] = [
    { role: 'user', parts: [{ text: 'hi' }] },
    { role: 'model', parts: [{ text: 'hello' }] },
  ];
  assertEquals(fitHistoryToTokenBudget(history, 1000), history);
});
