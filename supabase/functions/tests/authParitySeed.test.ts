/**
 * Doc 21.2 / 21.6 — table-driven auth parity against a real stack (optional).
 *
 * Skipped in CI unless AUTH_PARITY_FIXTURE points at a JSON file with JWT env bindings.
 *
 *   cp supabase/functions/tests/fixtures/auth-parity-seed.example.json \\
 *      supabase/functions/tests/fixtures/auth-parity-seed.local.json
 *   # fill query params + export JWTs from local sign-in
 *   AUTH_PARITY_FIXTURE=supabase/functions/tests/fixtures/auth-parity-seed.local.json \\
 *     AUTH_PARITY_PROPERTY_MEMBER_JWT=... \\
 *     deno test --allow-net --allow-env --allow-read supabase/functions/tests/authParitySeed.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

type ParityCase = {
  id: string;
  doc?: string;
  jwtEnv: string;
  method: 'GET' | 'POST';
  function: string;
  query?: string;
  body?: string;
  expectStatus: number[];
};

type ParityFixture = {
  cases: ParityCase[];
};

function resolveFunctionsBase(): string {
  const raw = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  if (!raw) return '';
  if (raw.endsWith('/functions/v1')) return raw;
  return `${raw}/functions/v1`;
}

const fixturePath = Deno.env.get('AUTH_PARITY_FIXTURE')?.trim() ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const functionsBase = resolveFunctionsBase();
const enabled = Boolean(fixturePath && functionsBase && anonKey);

let cases: ParityCase[] = [];
if (enabled) {
  const raw = await Deno.readTextFile(fixturePath);
  const parsed = JSON.parse(raw) as ParityFixture;
  cases = parsed.cases ?? [];
}

Deno.test({
  name: 'auth parity fixture harness documents skip when AUTH_PARITY_FIXTURE unset',
  ignore: enabled,
  fn: () => {
    assertEquals(fixturePath, '');
  },
});

for (const c of cases) {
  Deno.test({
    name: `auth parity [${c.doc ?? '21'}] ${c.id}`,
    ignore: !enabled,
    fn: async () => {
      const jwt = Deno.env.get(c.jwtEnv)?.trim();
      if (!jwt) {
        throw new Error(`Missing env ${c.jwtEnv} for case ${c.id}`);
      }
      const url = `${functionsBase}/${c.function}${c.query ? `?${c.query}` : ''}`;
      const res = await fetch(url, {
        method: c.method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: c.method === 'POST' ? (c.body ?? '{}') : undefined,
      });
      assertEquals(
        c.expectStatus.includes(res.status),
        true,
        `${c.id}: expected ${c.expectStatus.join('|')}, got ${res.status}`
      );
    },
  });
}
