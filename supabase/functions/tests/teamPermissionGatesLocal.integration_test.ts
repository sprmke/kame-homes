/**
 * Live gate check against the local stack (`./dev.sh`, functions served on :54321).
 * Seeds a throwaway auth user + property_members row on an existing local property, calls the
 * real handlers, and cleans up. Skipped unless LOCAL_GATES_LIVE=1.
 *
 *   LOCAL_GATES_LIVE=1 deno test --allow-net --allow-env --allow-read \
 *     supabase/functions/tests/teamPermissionGatesLocal.integration_test.ts
 *
 * Asserts the permission layer only: a member missing the leaf gets 403, and once the leaf is
 * granted the same call no longer fails with 403 (it may still return 402 / 4xx from the plan
 * or body validation, which is the next gate).
 */

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const enabled = Deno.env.get('LOCAL_GATES_LIVE') === '1';
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const BASE_PERMISSIONS = [
  'bookings:view',
  'marketing:view',
  'marketing.generate:add',
  'pricing:view',
  'pricing.rates:edit',
  'analytics:view',
];

const service = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...service, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

Deno.test({
  name: 'team permission gates: 403 without the leaf, not 403 with it (live local)',
  ignore: !enabled,
  fn: async () => {
    // activity_log is append-only (trigger), so pick a property that already has activity rows
    // instead of seeding one.
    const [withActivity] = await rest(
      'activity_log?select=property_id&property_id=not.is.null&limit=1'
    );
    const [property] = await rest(
      `properties?select=id,slug,organization_id,organizations(slug)&id=eq.${withActivity.property_id}`
    );
    const propertyId = property.id as string;
    const orgSlug = property.organizations.slug as string;

    const email = `gate-test-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const password = 'Gate-test-pass-1!';
    const created = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: service,
      body: JSON.stringify({ email, password, email_confirm: true }),
    }).then((r) => r.json());
    const userId = created.id as string;
    let memberId = '';

    try {
      const [member] = await rest('property_members', {
        method: 'POST',
        body: JSON.stringify({
          property_id: propertyId,
          user_id: userId,
          role_id: 'ADMIN',
          permissions: BASE_PERMISSIONS,
          status: 'active',
        }),
      });
      memberId = member.id as string;

      // Password sign-in is captcha-protected locally, so mint a session from an admin magic link.
      const link = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: service,
        body: JSON.stringify({ type: 'magiclink', email }),
      }).then((r) => r.json());
      const token = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
      })
        .then((r) => r.json())
        .then((j) => j.access_token as string);

      const call = async (fn: string, method: string, body?: unknown, query = '') => {
        const res = await fetch(
          `${LOCAL_SUPABASE_URL}/functions/v1/${fn}?property_id=${propertyId}${query}`,
          {
            method,
            headers: {
              apikey: ANON_KEY,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
          }
        );
        await res.text();
        return res.status;
      };

      const cases: Array<{
        name: string;
        leaf: string;
        run: () => Promise<number>;
      }> = [
        {
          name: 'generate-marketing-media (image)',
          leaf: 'marketing.generate.image:add',
          run: () => call('generate-marketing-media', 'POST', { mediaType: 'image', prompt: 'x' }),
        },
        {
          name: 'upload-marketing-generation-reference',
          leaf: 'marketing.generate.image:add',
          run: () => call('upload-marketing-generation-reference', 'GET'),
        },
        {
          name: 'analytics-ai-review POST',
          leaf: 'analytics.aiReview:add',
          run: () => call('analytics-ai-review', 'POST', {}),
        },
        {
          name: 'smart-pricing-settings PATCH',
          leaf: 'pricing.smartPricing:edit',
          run: () => call('smart-pricing-settings', 'PATCH', { enabled: false }),
        },
        {
          name: 'smart-pricing-preview',
          leaf: 'pricing.smartPricing:edit',
          run: () => call('smart-pricing-preview', 'POST', {}),
        },
        {
          name: 'smart-pricing-apply',
          leaf: 'pricing.smartPricing:edit',
          run: () => call('smart-pricing-apply', 'POST', {}),
        },
      ];

      // Without the new leaves: every call is a permission failure.
      for (const c of cases) {
        assertEquals(await c.run(), 403, `${c.name} without ${c.leaf}`);
      }

      // Grant the leaves: the permission gate no longer rejects (plan / validation may).
      await rest(`property_members?id=eq.${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          permissions: [...BASE_PERMISSIONS, ...new Set(cases.map((c) => c.leaf))],
        }),
      });
      for (const c of cases) {
        assertNotEquals(await c.run(), 403, `${c.name} with ${c.leaf}`);
      }

      // Activity: member without `activity:view` gets an empty feed; with it, the call succeeds.
      const activity = async () => {
        const res = await fetch(
          `${LOCAL_SUPABASE_URL}/functions/v1/list-activity-log?orgSlug=${orgSlug}&propertyId=${propertyId}`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        return { status: res.status, events: (json.data?.events ?? []) as unknown[] };
      };
      const without = await activity();
      assertEquals(without.events.length, 0, 'no activity:view -> no rows');
      await rest(`property_members?id=eq.${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          permissions: [...BASE_PERMISSIONS, 'activity:view'],
        }),
      });
      const withLeaf = await activity();
      assertEquals(withLeaf.status, 200);
      assertEquals(withLeaf.events.length >= 1, true, 'activity:view -> sees the seeded row');
    } finally {
      if (memberId) await rest(`property_members?id=eq.${memberId}`, { method: 'DELETE' });
      await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: service,
      });
    }
  },
});
