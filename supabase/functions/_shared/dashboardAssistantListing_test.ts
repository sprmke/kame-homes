import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { clampListLimit, limitWithMarker, MAX_LIST_LIMIT } from './dashboardAssistantListing.ts';

Deno.test('rows within the limit come back untouched, with no marker', () => {
  assertEquals(limitWithMarker([1, 2, 3], 3, 'narrow it'), [1, 2, 3]);
  assertEquals(limitWithMarker([], 5, 'narrow it'), []);
});

Deno.test('cut-off rows end with a marker that says how many exist', () => {
  const out = limitWithMarker([1, 2, 3, 4, 5], 2, 'Use query.');
  assertEquals(out, [1, 2, { truncated: true, total: 5, shown: 2, hint: 'Use query.' }]);
});

Deno.test('limit is clamped and junk falls back to the default', () => {
  assertEquals(clampListLimit(undefined), 10);
  assertEquals(clampListLimit('abc'), 10);
  assertEquals(clampListLimit(NaN), 10);
  assertEquals(clampListLimit(0), 1);
  assertEquals(clampListLimit(-4), 1);
  assertEquals(clampListLimit(7.9), 7);
  assertEquals(clampListLimit('15'), 15);
  assertEquals(clampListLimit(9999), MAX_LIST_LIMIT);
});
