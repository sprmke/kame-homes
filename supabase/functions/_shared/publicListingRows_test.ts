import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { loadRowsByKeyChunks } from './publicListingRows.ts';

Deno.test('loadRowsByKeyChunks pages past the 1,000-row max_rows cap per chunk', async () => {
  // 2 keys × 1,500 rows each → one chunk returning 3,000 rows across 3 pages.
  const all = Array.from({ length: 3000 }, (_, i) => ({ id: i, key: i < 1500 ? 'a' : 'b' }));
  const calls: Array<[number, number]> = [];
  const rows = await loadRowsByKeyChunks('test', ['a', 'b'], (chunk, from, to) => {
    calls.push([from, to]);
    const matching = all.filter((row) => chunk.includes(row.key));
    // Simulate PostgREST max_rows = 1000.
    return Promise.resolve({
      data: matching.slice(from, Math.min(to + 1, from + 1000)),
      error: null,
    });
  });
  assertEquals(rows.length, 3000);
  assertEquals(calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
    [3000, 3999],
  ]);
});

Deno.test('loadRowsByKeyChunks splits keys into chunks of 200', async () => {
  const keys = Array.from({ length: 450 }, (_, i) => i);
  const chunkSizes: number[] = [];
  await loadRowsByKeyChunks('test', keys, (chunk) => {
    chunkSizes.push(chunk.length);
    return Promise.resolve({ data: [], error: null });
  });
  assertEquals(chunkSizes, [200, 200, 50]);
});

Deno.test('loadRowsByKeyChunks fails closed on a query error', async () => {
  await assertRejects(
    () =>
      loadRowsByKeyChunks('reviews', ['a'], () =>
        Promise.resolve({ data: null, error: { message: 'boom' } })
      ),
    Error,
    'reviews query failed: boom'
  );
});
