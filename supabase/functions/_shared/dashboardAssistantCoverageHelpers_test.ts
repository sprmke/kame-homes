import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  COVERAGE_READ_TOOL_NAMES,
  formatSuperhostCriteria,
  isCoverageTool,
  sanitizeHelpQuery,
} from './dashboardAssistantCoverageHelpers.ts';
import type { SuperhostCriteriaSnapshot } from './superhostMetrics.ts';

Deno.test('coverage names are all coverage tools', async () => {
  for (const name of COVERAGE_READ_TOOL_NAMES) {
    assertEquals(isCoverageTool(name), true);
  }
  assertEquals(isCoverageTool('list_bookings'), false);
  assertEquals(COVERAGE_READ_TOOL_NAMES.length, 14);
  const source = await Deno.readTextFile(
    new URL('./dashboardAssistantCoverageTools.ts', import.meta.url)
  );
  const declared = [...source.matchAll(/^    name: '([a-z_0-9]+)',$/gm)].map((m) => m[1]).sort();
  assertEquals(declared, [...COVERAGE_READ_TOOL_NAMES].sort());
});

Deno.test('sanitizeHelpQuery strips ILIKE metacharacters and empty noise', () => {
  assertEquals(sanitizeHelpQuery(null), null);
  assertEquals(sanitizeHelpQuery('   '), null);
  assertEquals(sanitizeHelpQuery('%_(foo)'), 'foo');
  assertEquals(sanitizeHelpQuery('%%%'), null);
  assertEquals(sanitizeHelpQuery('How do I set rates?'), 'How do I set rates?');
  assertEquals(sanitizeHelpQuery('50% off (weekend)'), '50  off  weekend');
});

Deno.test('formatSuperhostCriteria maps hydrator fields (met + current)', () => {
  const criteria: SuperhostCriteriaSnapshot = {
    rating: { value: 4.9, required: 4.8, met: true, sampleSize: 12 },
    responseRate: { value: 0.95, required: 0.9, met: true, sampleSize: 20 },
    cancellationRate: { value: 0.02, required: 0.01, met: false, sampleSize: 40 },
    activity: {
      value: 12,
      required: 10,
      met: true,
      sampleSize: 12,
      metVia: 'ten_stays',
    },
  };
  const rows = formatSuperhostCriteria(criteria);
  assertEquals(
    rows.map((row) => row.id),
    ['stays', 'rating', 'response', 'cancellation']
  );
  assertEquals(
    rows.map((row) => row.met),
    [true, true, true, false]
  );
  assertEquals(rows[0]?.current, '12');
  assertEquals(rows[1]?.current, '4.9');
  assertEquals(rows[2]?.current, '95%');
  assertEquals(rows[3]?.current, '2%');
});
