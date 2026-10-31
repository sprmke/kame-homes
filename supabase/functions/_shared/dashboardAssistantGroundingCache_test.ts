import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  getCachedGroundingFacts,
  groundingCacheKey,
  invalidateGroundingCache,
  resetGroundingCacheForTests,
} from './dashboardAssistantGroundingCache.ts';

Deno.test('grounding cache hits within 60s and misses after TTL', async () => {
  resetGroundingCacheForTests();
  let loads = 0;
  const load = async () => {
    loads += 1;
    return { n: loads };
  };
  const key = groundingCacheKey('org', 'user', 'prop', ['a', 'b']);
  let now = 1_000;
  const a = await getCachedGroundingFacts(key, load, () => now);
  const b = await getCachedGroundingFacts(key, load, () => now);
  assertEquals(a.n, 1);
  assertEquals(b.n, 1);
  assertEquals(loads, 1);
  now = 1_000 + 60_001;
  const c = await getCachedGroundingFacts(key, load, () => now);
  assertEquals(c.n, 2);
  assertEquals(loads, 2);
});

Deno.test('grounding cache keys sort permissions so order does not split the entry', () => {
  assertEquals(
    groundingCacheKey('o', 'u', null, ['edit', 'view']),
    groundingCacheKey('o', 'u', null, ['view', 'edit'])
  );
});

Deno.test('invalidateGroundingCache drops only that org', async () => {
  resetGroundingCacheForTests();
  let orgA = 0;
  let orgB = 0;
  const keyA = groundingCacheKey('org-a', 'u', null, []);
  const keyB = groundingCacheKey('org-b', 'u', null, []);
  await getCachedGroundingFacts(keyA, async () => {
    orgA += 1;
    return orgA;
  });
  await getCachedGroundingFacts(keyB, async () => {
    orgB += 1;
    return orgB;
  });
  invalidateGroundingCache('org-a');
  await getCachedGroundingFacts(keyA, async () => {
    orgA += 1;
    return orgA;
  });
  await getCachedGroundingFacts(keyB, async () => {
    orgB += 1;
    return orgB;
  });
  assertEquals(orgA, 2);
  assertEquals(orgB, 1);
});
