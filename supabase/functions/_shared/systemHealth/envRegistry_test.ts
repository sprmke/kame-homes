import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  EDGE_ENV_REGISTRY,
  evaluateEdgeEnv,
  validateAes256Key,
  validatePaymongoSecret,
  validateSentryDsn,
  validateVapidKeys,
} from './envRegistry.ts';

const getter = (env: Record<string, string>) => (key: string) => env[key];
const find = (checks: ReturnType<typeof evaluateEdgeEnv>, id: string) =>
  checks.find((check) => check.id === id)!;

Deno.test('missing required key is error in every environment', () => {
  for (const isProd of [true, false]) {
    assertEquals(
      find(evaluateEdgeEnv(getter({}), isProd), 'env.edge.SUPABASE_URL').status,
      'error'
    );
  }
});

Deno.test('prodRequired cron secret is error in prod, off in dev', () => {
  const id = 'env.edge.CALENDAR_SYNC_CRON_SECRET';
  assertEquals(find(evaluateEdgeEnv(getter({}), true), id).status, 'error');
  assertEquals(find(evaluateEdgeEnv(getter({}), false), id).status, 'off');
});

Deno.test('posture rules only run in production', () => {
  const checks = evaluateEdgeEnv(getter({}), false).filter((c) => c.id.startsWith('posture.edge.'));
  assert(checks.length > 0);
  assert(checks.every((check) => check.status === 'off'));
});

Deno.test('GEMINI_API_KEYS satisfies GEMINI_API_KEY and reports a count', () => {
  const check = find(
    evaluateEdgeEnv(getter({ GEMINI_API_KEYS: 'a,b,c' }), true),
    'env.edge.GEMINI_API_KEY'
  );
  assertEquals(check.status, 'ok');
  assertEquals(check.detail, '3 keys');
});

Deno.test('secret values never appear in check output', () => {
  const secret = 'super-secret-value-should-not-leak-1234567890';
  const env: Record<string, string> = {};
  for (const def of EDGE_ENV_REGISTRY) {
    if (!def.showValue) env[def.key] = secret;
  }
  const output = JSON.stringify(evaluateEdgeEnv(getter(env), true));
  assert(!output.includes(secret));
});

Deno.test('validators', () => {
  assertEquals(validateAes256Key('a'.repeat(64)), null);
  assertEquals(validateAes256Key(btoa('x'.repeat(32))), null);
  assertEquals(validateAes256Key('short')?.status, 'error');

  assertEquals(validatePaymongoSecret('sk_live_x', true), null);
  assertEquals(validatePaymongoSecret('sk_test_x', false), null);
  assertEquals(validatePaymongoSecret('sk_test_x', true)?.status, 'warn');
  assertEquals(validatePaymongoSecret('pk_live_x', true)?.status, 'error');

  assertEquals(validateVapidKeys('{"publicKey":"a","privateKey":"b"}'), null);
  assertEquals(validateVapidKeys('nope')?.status, 'error');

  assertEquals(validateSentryDsn('https://abc@o1.ingest.sentry.io/123'), null);
  assertEquals(validateSentryDsn('https://o1.ingest.sentry.io/')?.status, 'error');
});

Deno.test('tuning knobs show their default when unset', () => {
  const check = find(
    evaluateEdgeEnv(getter({}), true),
    'env.edge.CALENDAR_SYNC_MIN_INTERVAL_MINUTES'
  );
  assertEquals(check.status, 'off');
  assertEquals(check.detail, 'Default 30');
});

Deno.test('review pepper is recommended in production only', () => {
  const id = 'env.edge.REVIEW_IDENTITY_PEPPER';
  assertEquals(find(evaluateEdgeEnv(getter({}), true), id).status, 'warn');
  assertEquals(find(evaluateEdgeEnv(getter({}), false), id).status, 'off');
});

Deno.test('debug logs and publishing scope exclusion warn in production', () => {
  const checks = evaluateEdgeEnv(
    getter({ EDGE_LOG_DEBUG: '1', META_OAUTH_EXCLUDE_PUBLISHING_SCOPES: '1' }),
    true
  );
  assertEquals(find(checks, 'posture.edge.EDGE_LOG_DEBUG').status, 'warn');
  assertEquals(find(checks, 'posture.edge.META_OAUTH_EXCLUDE_PUBLISHING_SCOPES').status, 'warn');
});

Deno.test('missing secrets link to the project secrets page', () => {
  const check = find(
    evaluateEdgeEnv(getter({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' }), true),
    'env.edge.RESEND_API_KEY'
  );
  assertEquals(
    check.manageHref,
    'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/functions/secrets'
  );
});
