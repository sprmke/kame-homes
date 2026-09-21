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

async function edgePost(path: string, headers: Record<string, string>): Promise<Response> {
  return fetch(`${functionsBase}/${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: '{}',
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

Deno.test({
  name: 'anon without Authorization cannot call serveAdmin dashboard-stats',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('dashboard-stats', {});
    assertUnauthorized(res.status, 'dashboard-stats');
  },
});

Deno.test({
  name: 'malformed Bearer JWT cannot call serveAuthenticated list-organizations',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('list-organizations', {
      Authorization: 'Bearer not.a.valid.jwt',
    });
    assertUnauthorized(res.status, 'list-organizations (bad jwt)');
  },
});

Deno.test({
  name: 'POST without cron secret cannot invoke serveCronPost telegram-admin-cron',
  ignore: !live,
  fn: async () => {
    const res = await edgePost('telegram-admin-cron', {});
    assertUnauthorized(res.status, 'telegram-admin-cron');
  },
});

Deno.test({
  name: 'anon without Authorization cannot call serveAdmin org-settings',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('org-settings', {});
    assertUnauthorized(res.status, 'org-settings');
  },
});

Deno.test({
  name: 'POST without cron secret cannot invoke serveCronPost activity-log-retention-cron',
  ignore: !live,
  fn: async () => {
    const res = await edgePost('activity-log-retention-cron', {});
    assertUnauthorized(res.status, 'activity-log-retention-cron');
  },
});

Deno.test({
  name: 'anon without Authorization cannot call serveSuperAdmin list-organizations-admin',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('list-organizations-admin', {});
    assertUnauthorized(res.status, 'list-organizations-admin');
  },
});

Deno.test({
  name: 'anon without Authorization cannot call serveSuperAdmin list-support-tickets-admin',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('list-support-tickets-admin', {});
    assertUnauthorized(res.status, 'list-support-tickets-admin');
  },
});

Deno.test({
  name: 'anon without Authorization cannot call serveAuthenticated list-support-tickets',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('list-support-tickets', {});
    assertUnauthorized(res.status, 'list-support-tickets');
  },
});

Deno.test({
  name: 'anon can call servePublic get-health (positive control)',
  ignore: !live,
  fn: async () => {
    const res = await edgeGet('get-health', {});
    assertEquals(res.status, 200, 'get-health status code');
    const json = await res.json();
    assertEquals(
      json.status === 'ok' || json.status === 'degraded',
      true,
      `get-health body.status (got ${JSON.stringify(json.status)})`
    );
  },
});
