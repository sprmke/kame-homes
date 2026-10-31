import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  DB_SIZE_REFERENCE_BYTES,
  evaluateAiProviders,
  evaluateDatabase,
  evaluateEmailTraffic,
  evaluatePayments,
  evaluateTenantIntegrations,
  type SystemHealthSnapshot,
} from './snapshotChecks.ts';

function snapshot(overrides: Partial<SystemHealthSnapshot> = {}): SystemHealthSnapshot {
  return {
    extensions: { pg_cron: true, pg_net: true },
    cron_jobs: [],
    vault_secret_names: ['project_url', 'anon_key'],
    db_size_bytes: 100 * 1024 ** 2,
    heartbeats: [],
    probes: [],
    platform_settings: null,
    ai_settings: null,
    meta: null,
    calendar_feeds: null,
    push: null,
    marketing_jobs: null,
    paymongo_last_event_at: null,
    ...overrides,
  };
}

const status = (checks: { id: string; status: string }[], id: string) =>
  checks.find((check) => check.id === id)?.status;

Deno.test('vault parity flags an edge secret without its Vault twin', () => {
  const get = (key: string) => (key === 'CALENDAR_SYNC_CRON_SECRET' ? 'x' : undefined);
  const checks = evaluateDatabase(snapshot(), get, false);
  assertEquals(status(checks, 'db.vault.parity.CALENDAR_SYNC_CRON_SECRET'), 'error');
  assertEquals(status(checks, 'db.vault.parity.SD_REFUND_CRON_SECRET'), 'off');
});

Deno.test('vault parity is ok when both sides are set', () => {
  const get = (key: string) => (key === 'CALENDAR_SYNC_CRON_SECRET' ? 'x' : undefined);
  const checks = evaluateDatabase(
    snapshot({ vault_secret_names: ['project_url', 'anon_key', 'calendar_sync_cron_secret'] }),
    get,
    true
  );
  assertEquals(status(checks, 'db.vault.parity.CALENDAR_SYNC_CRON_SECRET'), 'ok');
});

Deno.test('database size thresholds', () => {
  const at = (pct: number) =>
    status(
      evaluateDatabase(
        snapshot({ db_size_bytes: DB_SIZE_REFERENCE_BYTES * pct }),
        () => undefined,
        true
      ),
      'db.size'
    );
  assertEquals(at(0.5), 'ok');
  assertEquals(at(0.85), 'warn');
  assertEquals(at(0.96), 'error');
});

Deno.test('tenant integrations roll up counters', () => {
  const checks = evaluateTenantIntegrations(
    snapshot({
      meta: {
        total: 3,
        connected: 2,
        error: 0,
        disconnected: 1,
        token_expired: 1,
        token_expiring_7d: 0,
        webhook_unverified_24h: 0,
      },
      calendar_feeds: { active: 4, failing: 0, stale_6h: 1 },
      push: { active: 0, disabled: 0, failing: 0 },
    })
  );
  assertEquals(status(checks, 'tenant.meta.tokens'), 'error');
  assertEquals(status(checks, 'tenant.calendar.feeds'), 'warn');
  assertEquals(status(checks, 'tenant.push.subscriptions'), 'off');
});

const ai = (calls: number, errors = 0, rate_limited = 0, auth = 0) => ({
  calls,
  errors,
  rate_limited,
  auth,
  last_error_at: null,
});

Deno.test('AI provider traffic flags rejected keys and quota errors', () => {
  const checks = evaluateAiProviders(
    snapshot({ ai_providers: { gemini: ai(100, 5, 0, 2), groq: ai(50, 3, 3) } })
  );
  assertEquals(status(checks, 'traffic.ai.gemini'), 'error');
  assertEquals(status(checks, 'traffic.ai.groq'), 'warn');
  assertEquals(
    status(
      evaluateAiProviders(snapshot({ ai_providers: { gemini: ai(100, 20) } })),
      'traffic.ai.gemini'
    ),
    'warn'
  );
  assertEquals(
    status(
      evaluateAiProviders(snapshot({ ai_providers: { gemini: ai(100, 5) } })),
      'traffic.ai.gemini'
    ),
    'ok'
  );
  assertEquals(
    status(evaluateAiProviders(snapshot({ ai_providers: {} })), 'traffic.ai.groq'),
    'off'
  );
  assertEquals(evaluateAiProviders(snapshot()).length, 0);
});

Deno.test('email traffic: complaints warn, inbound only when configured', () => {
  const email = {
    bounced_7d: 1,
    complained_7d: 1,
    inbound_7d: 4,
    inbound_failed_7d: 1,
    inbound_last_at: null,
  };
  const off = evaluateEmailTraffic(snapshot({ email }), () => undefined);
  assertEquals(status(off, 'traffic.email.deliverability'), 'warn');
  assertEquals(status(off, 'traffic.email.inbound'), undefined);
  const on = evaluateEmailTraffic(snapshot({ email }), (key) =>
    key === 'RESEND_INBOUND_WEBHOOK_SECRET' ? 's' : undefined
  );
  assertEquals(status(on, 'traffic.email.inbound'), 'warn');
});

Deno.test('payments webhook check needs PayMongo configured', () => {
  assertEquals(evaluatePayments(snapshot(), () => undefined).length, 0);
  const get = (key: string) => (key === 'PAYMONGO_SECRET_KEY' ? 'sk' : undefined);
  assertEquals(status(evaluatePayments(snapshot(), get), 'traffic.paymongo.webhook'), 'off');
  assertEquals(
    status(
      evaluatePayments(snapshot({ paymongo_last_event_at: '2026-10-18T00:00:00Z' }), get),
      'traffic.paymongo.webhook'
    ),
    'ok'
  );
});

Deno.test('telegram bots without credentials warn and list the units', () => {
  const checks = evaluateTenantIntegrations(
    snapshot({
      telegram: {
        enabled: 3,
        missing_creds: 1,
        missing_items: [
          { channel: 'Property', unit_name: 'Unit 5', org_name: 'Acme', org_slug: 'acme' },
        ],
      },
    })
  );
  const check = checks.find((c) => c.id === 'tenant.telegram.credentials')!;
  assertEquals(check.status, 'warn');
  assertEquals(check.items?.[0], {
    label: 'Acme · Unit 5',
    detail: 'Property',
    href: '/admin/orgs/acme',
  });
});

Deno.test('meta webhook failures warn with affected pages', () => {
  const checks = evaluateTenantIntegrations(
    snapshot({
      meta: {
        total: 1,
        connected: 1,
        error: 0,
        disconnected: 0,
        token_expired: 0,
        token_expiring_7d: 0,
        webhook_unverified_24h: 0,
        webhook_failing: 1,
      },
      meta_items: [
        {
          display_name: 'Acme FB',
          platform: 'facebook',
          org_name: 'Acme',
          org_slug: 'acme',
          reason: 'Webhook failing',
        },
      ],
    })
  );
  const hooks = checks.find((c) => c.id === 'tenant.meta.webhooks')!;
  assertEquals(hooks.status, 'warn');
  assertEquals(hooks.items?.length, 1);
  assertEquals(status(checks, 'tenant.meta.tokens'), 'ok');
});

Deno.test('voice canary with no report is off in production, unknown elsewhere', () => {
  const ai_settings = {
    enabled: true,
    enforce_quotas: true,
    voice_health_status: 'unknown' as const,
    voice_health_checked_at: null,
    voice_health_failure_code: null,
  };
  assertEquals(
    status(evaluateTenantIntegrations(snapshot({ ai_settings }), true), 'tenant.voice.canary'),
    'off'
  );
  assertEquals(
    status(evaluateTenantIntegrations(snapshot({ ai_settings }), false), 'tenant.voice.canary'),
    'unknown'
  );
});
