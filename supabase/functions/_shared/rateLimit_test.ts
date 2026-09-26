/**
 * Deno tests for _shared/rateLimit.ts — run with `deno test --allow-env` (not Bun's runner).
 * Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md (Phase 6)
 *
 * The counter RPC needs Postgres, so these cover the pure identity helper and the
 * fail-open contract (a broken `bump_rate_limit` must never block a caller).
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  checkRateLimit,
  identityFromRequest,
  isIdentityBlocked,
  rateLimitGate,
  resetBlockedIdentitiesCacheForTests,
} from './rateLimit.ts';

const realFetch = globalThis.fetch;

function reqWith(headers: Record<string, string> = {}): Request {
  return new Request('https://edge.example/fn', { method: 'POST', headers });
}

Deno.test('identityFromRequest: prefers the authenticated user id', () => {
  const id = identityFromRequest(reqWith({ 'x-forwarded-for': '1.2.3.4' }), { id: 'user-abc' });
  assertEquals(id, 'u:user-abc');
});

Deno.test('identityFromRequest: falls back to client IP prefix', () => {
  const id = identityFromRequest(reqWith({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }));
  assertEquals(id.startsWith('ip:'), true);
});

Deno.test('identityFromRequest: null / blank user id falls through to IP', () => {
  assertEquals(identityFromRequest(reqWith(), { id: null }).startsWith('ip:'), true);
  assertEquals(identityFromRequest(reqWith(), { id: '   ' }).startsWith('ip:'), true);
});

Deno.test('checkRateLimit: fails OPEN when the counter backend is unreachable', async () => {
  Deno.env.set('SUPABASE_URL', 'https://127.0.0.1:1');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  globalThis.fetch = () =>
    Promise.reject(new Error('network down')) as unknown as ReturnType<typeof realFetch>;
  try {
    const decision = await checkRateLimit({
      scope: 'unit-test',
      identity: 'ip:1.1.1.1',
      limit: 3,
      windowSec: 60,
    });
    assertEquals(decision.allowed, true);
    assertEquals(decision.count, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('rateLimitGate: returns null (proceed) when the check fails open', async () => {
  Deno.env.set('SUPABASE_URL', 'https://127.0.0.1:1');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  globalThis.fetch = () =>
    Promise.reject(new Error('network down')) as unknown as ReturnType<typeof realFetch>;
  try {
    const res = await rateLimitGate(reqWith(), {
      scope: 'unit-test',
      identity: 'ip:1.1.1.1',
      limit: 1,
      windowSec: 60,
    });
    assertEquals(res, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test(
  'isIdentityBlocked: fails OPEN (not blocked) when the block-list read is unreachable',
  async () => {
    Deno.env.set('SUPABASE_URL', 'https://127.0.0.1:1');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
    resetBlockedIdentitiesCacheForTests();
    globalThis.fetch = () =>
      Promise.reject(new Error('network down')) as unknown as ReturnType<typeof realFetch>;
    try {
      const blocked = await isIdentityBlocked('u:some-user');
      assertEquals(blocked, false);
    } finally {
      globalThis.fetch = realFetch;
      resetBlockedIdentitiesCacheForTests();
    }
  }
);
