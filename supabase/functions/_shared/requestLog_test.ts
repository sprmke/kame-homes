/**
 * requestLog — pure-helper coverage (no network).
 * Run: deno test --allow-env supabase/functions/_shared/requestLog_test.ts
 */

import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { resolveRequestId } from './requestLog.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.test('resolveRequestId — trusts a well-formed client-sent id', () => {
  const req = new Request('https://example.com', {
    headers: { 'x-request-id': 'client-abc-123' },
  });
  assertEquals(resolveRequestId(req), 'client-abc-123');
});

Deno.test('resolveRequestId — generates a fresh id when the header is missing', () => {
  const req = new Request('https://example.com');
  assertMatch(resolveRequestId(req), UUID_RE);
});

Deno.test('resolveRequestId — rejects an oversized or malformed header (falls back)', () => {
  const tooLong = new Request('https://example.com', {
    headers: { 'x-request-id': 'a'.repeat(65) },
  });
  assertMatch(resolveRequestId(tooLong), UUID_RE);

  const badChars = new Request('https://example.com', {
    headers: { 'x-request-id': '<script>alert(1)</script>' },
  });
  assertMatch(resolveRequestId(badChars), UUID_RE);
});

Deno.test('resolveRequestId — never throws on an empty header value', () => {
  const req = new Request('https://example.com', { headers: { 'x-request-id': '' } });
  assert(resolveRequestId(req).length > 0);
});
