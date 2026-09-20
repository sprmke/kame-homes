/**
 * Doc 21 / 29 — live adversarial checks against hosted dev (no DB seed).
 * Skipped when SUPABASE_URL + SUPABASE_ANON_KEY are unset (local `test:edge:handlers`).
 *
 * Run (hosted dev only):
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=... \
 *     deno test --allow-net --allow-env supabase/functions/tests/adversarialAuthLive.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

function resolveFunctionsBase(): string {
  const ref = Deno.env.get('SUPABASE_PROJECT_REF')?.trim();
  const raw = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  if (raw) {
    if (raw.endsWith('/functions/v1')) return raw;
    return `${raw}/functions/v1`;
  }
  if (ref) return `https://${ref}.supabase.co/functions/v1`;
  return '';
}

const functionsBase = resolveFunctionsBase();
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const live = Boolean(functionsBase && anonKey);

function assertUnauthorized(status: number, context: string): void {
  assertEquals(
    status === 401 || status === 403,
    true,
    `${context}: expected 401/403, got ${status}`
  );
}

async function edgeGet(path: string, headers: Record<string, string>): Promise<Response> {
  return fetch(`${functionsBase}/${path}`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      ...headers,
    },
  });
}

Deno.test({
  name: 'anon without Authorization cannot call serveAuthenticated list-organizations',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('list-organizations', {});
    assertUnauthorized(res.status, 'list-organizations');
  },
});

Deno.test({
  name: 'anon Bearer (anon JWT) cannot call serveAdmin list-bookings',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('list-bookings?propertyId=00000000-0000-0000-0000-000000000001', {
      Authorization: `Bearer ${anonKey}`,
    });
    assertUnauthorized(res.status, 'list-bookings');
  },
});

Deno.test({
  name: 'anon cannot call serveSuperAdmin super-admin-overview',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('super-admin-overview', {
      Authorization: `Bearer ${anonKey}`,
    });
    assertUnauthorized(res.status, 'super-admin-overview');
  },
});
