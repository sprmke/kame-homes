import { assertEquals } from 'jsr:@std/assert@1';

import {
  clampPage,
  MAX_LIST_ITEM_LENGTH,
  MAX_LIST_ITEMS,
  MAX_QUERY_LENGTH,
  MAX_RESULT_WINDOW,
  parseBoundedCsv,
  parseNonNegInt,
  parsePageSize,
  readQueryText,
  runPagedSearch,
  windowedPage,
  type SearchResult,
} from './publicListingSearch.ts';

Deno.test('readQueryText trims and caps free text', () => {
  assertEquals(readQueryText('  azure  '), 'azure');
  assertEquals(readQueryText(null), '');
  assertEquals(readQueryText('x'.repeat(500)).length, MAX_QUERY_LENGTH);
});

Deno.test('parseBoundedCsv dedupes, trims, and caps list size and item length', () => {
  assertEquals(parseBoundedCsv(' wifi, pool,,wifi '), ['wifi', 'pool']);
  assertEquals(parseBoundedCsv(null), []);
  const many = Array.from({ length: 100 }, (_, i) => `a${i}`).join(',');
  assertEquals(parseBoundedCsv(many).length, MAX_LIST_ITEMS);
  assertEquals(parseBoundedCsv('y'.repeat(300))[0]!.length, MAX_LIST_ITEM_LENGTH);
});

Deno.test('parseNonNegInt and parsePageSize clamp hostile values', () => {
  assertEquals(parseNonNegInt('-3'), 0);
  assertEquals(parseNonNegInt('999999'), 1000);
  assertEquals(parsePageSize('0', 24, 48), 24);
  assertEquals(parsePageSize('500', 24, 48), 48);
});

Deno.test('clampPage respects both the result set and the result window', () => {
  assertEquals(clampPage(9, 24, 50), 3);
  assertEquals(clampPage(0, 24, 50), 1);
  assertEquals(clampPage(10_000, 24, 10_000_000), Math.floor(MAX_RESULT_WINDOW / 24));
  assertEquals(windowedPage(100_000, 48), Math.floor(MAX_RESULT_WINDOW / 48));
});

function fakeSearch(total: number) {
  const calls: Array<{ limit: number; offset: number; facets: boolean }> = [];
  const run = (args: { limit: number; offset: number; facets: boolean }) => {
    calls.push(args);
    const ids = Array.from({ length: Math.max(0, Math.min(args.limit, total - args.offset)) }, (_, i) =>
      String(args.offset + i)
    );
    return Promise.resolve<SearchResult<{ marker: number }>>({
      total,
      ids,
      facets: args.facets ? { marker: calls.length } : null,
      distances: null,
    });
  };
  return { run, calls };
}

Deno.test('runPagedSearch returns the requested page in one call', async () => {
  const { run, calls } = fakeSearch(100);
  const out = await runPagedSearch(run, { page: 2, pageSize: 24, mapMode: false, mapCap: 200 });
  assertEquals(out.page, 2);
  assertEquals(out.result.ids[0], '24');
  assertEquals(calls.length, 1);
});

Deno.test('runPagedSearch clamps a page past the end and keeps first-call facets', async () => {
  const { run, calls } = fakeSearch(50);
  const out = await runPagedSearch(run, { page: 9, pageSize: 24, mapMode: false, mapCap: 200 });
  assertEquals(out.page, 3);
  assertEquals(out.result.ids, ['48', '49']);
  assertEquals(out.result.facets, { marker: 1 });
  assertEquals(calls[1], { limit: 24, offset: 48, facets: false });
});

Deno.test('runPagedSearch map mode ignores page and uses the marker cap', async () => {
  const { run, calls } = fakeSearch(1000);
  const out = await runPagedSearch(run, { page: 5, pageSize: 24, mapMode: true, mapCap: 200 });
  assertEquals(out.page, 1);
  assertEquals(out.pageSize, 200);
  assertEquals(calls[0], { limit: 200, offset: 0, facets: true });
});

Deno.test('runPagedSearch on an empty result makes one call', async () => {
  const { run, calls } = fakeSearch(0);
  const out = await runPagedSearch(run, { page: 4, pageSize: 24, mapMode: false, mapCap: 200 });
  assertEquals(out.result.total, 0);
  assertEquals(calls.length, 1);
});
