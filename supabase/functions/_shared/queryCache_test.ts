/**
 * queryCache — pure-helper coverage (no Supabase / network).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/queryCache_test.ts
 *
 * Focused on the doc 12 "most dangerous bug in this doc" property: a cache key that omits a
 * viewer-permission dimension must never collide with a key for a different permission scope.
 * readThrough/purgeCacheByScope/sweepExpiredCacheRows need a live Supabase client and are not
 * covered here — see the doc's "Implementation status" section for what's DB-verified vs not.
 */

import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildCacheKey, QUERY_CACHE_SCHEMA_VERSION } from './queryCache.ts';

Deno.test('buildCacheKey — same scope, different permission scope → different key', () => {
  const base = {
    namespace: 'dashboard-stats',
    scope: { orgId: 'org-1' },
    params: { from: '2026-01-01', to: '2026-01-31' },
  };

  const allListings = buildCacheKey({ ...base, permissionScope: ['all_listings'] });
  const scopedAdminA = buildCacheKey({
    ...base,
    permissionScope: ['scoped', 'p:prop-1'],
  });
  const scopedAdminB = buildCacheKey({
    ...base,
    permissionScope: ['scoped', 'p:prop-2'],
  });

  // The critical security property: an all-listings admin's key must never collide with a
  // scoped admin's key for the same org, and two differently-scoped admins must never
  // collide with each other — otherwise one viewer's cached response leaks to another with a
  // different (narrower or wider) permission set.
  assertNotEquals(allListings, scopedAdminA);
  assertNotEquals(allListings, scopedAdminB);
  assertNotEquals(scopedAdminA, scopedAdminB);
});

Deno.test('buildCacheKey — permission scope order does not change the key', () => {
  const base = {
    namespace: 'dashboard-stats',
    scope: { orgId: 'org-1' },
  };
  const a = buildCacheKey({
    ...base,
    permissionScope: ['scoped', 'p:prop-1', 'p:prop-2'],
  });
  const b = buildCacheKey({
    ...base,
    permissionScope: ['scoped', 'p:prop-2', 'p:prop-1'],
  });
  assertEquals(a, b);
});

Deno.test('buildCacheKey — different scope ids never collide', () => {
  const keyFor = (orgId: string) =>
    buildCacheKey({
      namespace: 'dashboard-stats',
      scope: { orgId },
      permissionScope: ['all_listings'],
    });
  assertNotEquals(keyFor('org-1'), keyFor('org-2'));
});

Deno.test(
  'buildCacheKey — different namespace never collides even with identical scope/params',
  () => {
    const scope = { propertyId: 'prop-1' };
    const a = buildCacheKey({ namespace: 'dashboard-stats', scope, permissionScope: null });
    const b = buildCacheKey({ namespace: 'finance-summary', scope, permissionScope: null });
    assertNotEquals(a, b);
  }
);

Deno.test('buildCacheKey — different params (filters/date range) never collide', () => {
  const scope = { propertyId: 'prop-1' };
  const jan = buildCacheKey({
    namespace: 'dashboard-stats',
    scope,
    params: { from: '2026-01-01', to: '2026-01-31' },
    permissionScope: null,
  });
  const feb = buildCacheKey({
    namespace: 'dashboard-stats',
    scope,
    params: { from: '2026-02-01', to: '2026-02-28' },
    permissionScope: null,
  });
  assertNotEquals(jan, feb);
});

Deno.test('buildCacheKey — is deterministic for identical input', () => {
  const args = {
    namespace: 'dashboard-stats',
    scope: { orgId: 'org-1', propertyId: 'prop-1' },
    params: { from: '2026-01-01', to: '2026-01-31' },
    permissionScope: ['all_listings'],
  };
  assertEquals(buildCacheKey(args), buildCacheKey(args));
});

Deno.test('buildCacheKey — embeds the schema version so a deploy invalidates all keys', () => {
  const key = buildCacheKey({
    namespace: 'dashboard-stats',
    scope: { propertyId: 'prop-1' },
    permissionScope: null,
  });
  assert(key.startsWith(`v${QUERY_CACHE_SCHEMA_VERSION}:`));
});
