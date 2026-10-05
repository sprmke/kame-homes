import { assertEquals } from 'jsr:@std/assert@1';

import {
  __resetListingCacheForTests,
  listingCacheKey,
  withListingCache,
} from './publicListingCache.ts';

type Versions = { property: number; development: number; parking: number };

function versionStub(initial: Versions) {
  const state = { ...initial, reads: 0, fail: false };
  const loader = () => {
    state.reads += 1;
    if (state.fail) return Promise.reject(new Error('db down'));
    return Promise.resolve({
      property: state.property,
      development: state.development,
      parking: state.parking,
    });
  };
  return { state, loader };
}

function counter() {
  let n = 0;
  return {
    compute: () => Promise.resolve(++n),
    get count() {
      return n;
    },
  };
}

Deno.test('cache hit returns the stored value without recomputing', async () => {
  const { loader } = versionStub({ property: 1, development: 1, parking: 1 });
  __resetListingCacheForTests(loader);
  const c = counter();
  const key = listingCacheKey('t', { a: 1 });
  assertEquals(await withListingCache(key, { families: ['property'] }, c.compute), 1);
  assertEquals(await withListingCache(key, { families: ['property'] }, c.compute), 1);
  assertEquals(c.count, 1);
});

Deno.test('a catalog version bump invalidates entries for that family', async () => {
  const { state, loader } = versionStub({ property: 1, development: 1, parking: 1 });
  __resetListingCacheForTests(loader);
  const c = counter();
  const key = listingCacheKey('t', { a: 1 });
  await withListingCache(key, { families: ['property'] }, c.compute);
  state.property = 2;
  // Version snapshot is memoized for a few seconds; reset only the snapshot.
  __resetListingCacheForTests(loader);
  assertEquals(await withListingCache(key, { families: ['property'] }, c.compute), 2);
});

Deno.test('bypass always computes', async () => {
  const { loader } = versionStub({ property: 1, development: 1, parking: 1 });
  __resetListingCacheForTests(loader);
  const c = counter();
  const key = listingCacheKey('t', { dates: true });
  await withListingCache(key, { families: ['property'], bypass: true }, c.compute);
  await withListingCache(key, { families: ['property'], bypass: true }, c.compute);
  assertEquals(c.count, 2);
});

Deno.test('a failed version read falls back to computing directly', async () => {
  const { state, loader } = versionStub({ property: 1, development: 1, parking: 1 });
  state.fail = true;
  __resetListingCacheForTests(loader);
  const c = counter();
  const key = listingCacheKey('t', {});
  assertEquals(await withListingCache(key, { families: ['parking'] }, c.compute), 1);
  assertEquals(await withListingCache(key, { families: ['parking'] }, c.compute), 2);
});

Deno.test('concurrent identical misses share one compute', async () => {
  const { loader } = versionStub({ property: 1, development: 1, parking: 1 });
  __resetListingCacheForTests(loader);
  let n = 0;
  const slow = () => new Promise<number>((resolve) => setTimeout(() => resolve(++n), 10));
  const key = listingCacheKey('t', { b: 2 });
  const [a, b] = await Promise.all([
    withListingCache(key, { families: ['development'] }, slow),
    withListingCache(key, { families: ['development'] }, slow),
  ]);
  assertEquals([a, b, n], [1, 1, 1]);
});

Deno.test('a failed compute is not cached', async () => {
  const { loader } = versionStub({ property: 1, development: 1, parking: 1 });
  __resetListingCacheForTests(loader);
  const key = listingCacheKey('t', { fail: true });
  let attempts = 0;
  const flaky = () => {
    attempts += 1;
    return attempts === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('ok');
  };
  await withListingCache(key, { families: ['property'] }, flaky).catch(() => undefined);
  assertEquals(await withListingCache(key, { families: ['property'] }, flaky), 'ok');
});

Deno.test('listingCacheKey is independent of param order', () => {
  assertEquals(listingCacheKey('n', { a: 1, b: [2, 3] }), listingCacheKey('n', { b: [2, 3], a: 1 }));
});
