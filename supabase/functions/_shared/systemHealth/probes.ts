/**
 * On-demand live checks for third-party credentials. Each probe hits a free metadata endpoint
 * (never a billed generation/send call), times out after 5s, and is throttled to one run per
 * 60s per probe. Results are cached in `system_health_probe_results`; the summary view only
 * reads that cache.
 */
import type { SupabaseClient } from '../supabaseJs.ts';
import { META_GRAPH_BASE } from '../metaInboxConfig.ts';
import { decryptMetaInboxToken } from '../metaInboxCrypto.ts';
import { decryptPropertySecret } from '../propertySecretCrypto.ts';
import {
  classifyBearer,
  classifyGemini,
  classifyJamendo,
  classifyMetaAppToken,
  classifyMetaPageTokens,
  classifyPaymongo,
  classifyResend,
  classifySupabaseAuth,
  classifyTelegramBots,
  classifyTelegramGetMe,
  classifyTurnstile,
  metaTokenProblem,
  type MetaTokenDebug,
  type ProbeOutcome,
} from './probeClassifiers.ts';
import { type HealthCheck, type HealthCheckItem, type HealthStatus } from './types.ts';

export const PROBE_TIMEOUT_MS = 5_000;
export const PROBE_THROTTLE_MS = 60_000;
const META_PAGE_TOKEN_LIMIT = 20;
const TELEGRAM_TOKEN_LIMIT = 20;
const ITEM_LIMIT = 5;

type EnvGet = (key: string) => string | undefined;

type ProbeContext = { get: EnvGet; supabase: SupabaseClient };

export type ProbeDef = {
  id: string;
  label: string;
  group: string;
  features: string[];
  hint: string;
  /** Provider console for rotating the credential. */
  console?: string;
  isConfigured: (get: EnvGet) => boolean;
  run: (ctx: ProbeContext) => Promise<ProbeOutcome>;
};

export type ProbeResultRow = {
  probe_id: string;
  status: HealthStatus;
  detail: string | null;
  latency_ms: number | null;
  meta: Record<string, unknown>;
  checked_at: string;
};

async function fetchJson(
  url: string,
  init: RequestInit = {}
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function geminiKeys(get: EnvGet): string[] {
  const multi = get('GEMINI_API_KEYS')?.trim();
  if (multi)
    return multi
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  const single = get('GEMINI_API_KEY')?.trim();
  return single ? [single] : [];
}

const has =
  (...keys: string[]) =>
  (get: EnvGet) =>
    keys.every((key) => Boolean(get(key)?.trim()));

export const PROBES: ProbeDef[] = [
  {
    id: 'resend',
    console: 'https://resend.com/api-keys',
    label: 'Resend',
    group: 'Email',
    features: ['All email'],
    hint: 'Create a new key in Resend and update RESEND_API_KEY.',
    isConfigured: has('RESEND_API_KEY'),
    run: async ({ get }) => {
      const { status, body } = await fetchJson('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${get('RESEND_API_KEY')}` },
      });
      return classifyResend(status, body, get('RESEND_FROM_EMAIL'));
    },
  },
  {
    id: 'gemini',
    console: 'https://aistudio.google.com/apikey',
    label: 'Gemini',
    group: 'AI',
    features: ['All AI features'],
    hint: 'Replace the key in Google AI Studio, or raise its quota.',
    isConfigured: (get) => geminiKeys(get).length > 0,
    run: async ({ get }) => {
      const keys = geminiKeys(get);
      const outcomes = await Promise.all(
        keys.map(async (key) => {
          const { status, body } = await fetchJson(
            'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
            { headers: { 'x-goog-api-key': key } }
          );
          return classifyGemini(status, body);
        })
      );
      if (keys.length === 1) return outcomes[0];
      const okCount = outcomes.filter((o) => o.status === 'ok').length;
      const allFailed = okCount === 0;
      return {
        status: allFailed ? 'error' : okCount < keys.length ? 'warn' : 'ok',
        detail: `${okCount} of ${keys.length} keys valid`,
        meta: {
          keys: outcomes.map((o, i) => ({ index: i + 1, status: o.status, detail: o.detail })),
        },
      };
    },
  },
  {
    id: 'groq',
    console: 'https://console.groq.com/keys',
    label: 'Groq',
    group: 'AI',
    features: ['AI fallback'],
    hint: 'Create a new key in the Groq console.',
    isConfigured: has('GROQ_API_KEY'),
    run: async ({ get }) => {
      const { status } = await fetchJson('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${get('GROQ_API_KEY')}` },
      });
      return classifyBearer('Groq', status);
    },
  },
  {
    id: 'paymongo',
    console: 'https://dashboard.paymongo.com/developers',
    label: 'PayMongo',
    group: 'Payments',
    features: ['Platform billing', 'Guest payments'],
    hint: 'Check the secret key and webhook in the PayMongo dashboard.',
    isConfigured: has('PAYMONGO_SECRET_KEY'),
    run: async ({ get }) => {
      const { status, body } = await fetchJson('https://api.paymongo.com/v1/webhooks', {
        headers: { Authorization: `Basic ${btoa(`${get('PAYMONGO_SECRET_KEY')}:`)}` },
      });
      return classifyPaymongo(status, body);
    },
  },
  {
    id: 'meta_app',
    console: 'https://developers.facebook.com/apps',
    label: 'Meta app',
    group: 'Meta',
    features: ['Guest inbox', 'Meta publishing'],
    hint: 'Reset the app secret in Meta for Developers and update META_APP_SECRET.',
    isConfigured: has('META_APP_ID', 'META_APP_SECRET'),
    run: async ({ get }) => {
      const params = new URLSearchParams({
        client_id: get('META_APP_ID') ?? '',
        client_secret: get('META_APP_SECRET') ?? '',
        grant_type: 'client_credentials',
      });
      const { status, body } = await fetchJson(`${META_GRAPH_BASE}/oauth/access_token?${params}`);
      return classifyMetaAppToken(status, body);
    },
  },
  {
    id: 'meta_pages',
    label: 'Meta page tokens',
    group: 'Meta',
    features: ['Guest inbox', 'Meta publishing'],
    hint: 'Hosts must reconnect the page in Inbox settings.',
    isConfigured: has('META_APP_ID', 'META_APP_SECRET', 'META_INBOX_TOKEN_ENCRYPTION_KEY'),
    run: async ({ get, supabase }) => {
      const { data, error } = await supabase
        .from('social_channel_connections')
        .select('encrypted_access_token, display_name, platform, organizations(name, slug)')
        .eq('status', 'connected')
        .in('platform', ['facebook', 'instagram'])
        .not('encrypted_access_token', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(META_PAGE_TOKEN_LIMIT);
      if (error) return { status: 'unknown', detail: 'Could not read connections' };
      const appToken = `${get('META_APP_ID')}|${get('META_APP_SECRET')}`;
      const nowSec = Math.floor(Date.now() / 1000);
      const rows = (data ?? []) as Array<{
        encrypted_access_token: string;
        display_name: string | null;
        platform: string;
        organizations: { name: string; slug: string } | null;
      }>;
      const results = await Promise.all(
        rows.map(async (row): Promise<MetaTokenDebug> => {
          try {
            const token = await decryptMetaInboxToken(String(row.encrypted_access_token));
            const params = new URLSearchParams({ input_token: token, access_token: appToken });
            const { body } = await fetchJson(`${META_GRAPH_BASE}/debug_token?${params}`);
            return (body?.data ?? {}) as MetaTokenDebug;
          } catch {
            return { is_valid: false };
          }
        })
      );
      const outcome = classifyMetaPageTokens(results, nowSec);
      const items = rows.flatMap((row, i) => {
        const reason = metaTokenProblem(results[i], nowSec);
        return reason
          ? [
              {
                label: `${row.organizations?.name ?? 'Unknown org'} · ${row.display_name ?? row.platform}`,
                detail: reason,
                href: row.organizations?.slug ? `/admin/orgs/${row.organizations.slug}` : undefined,
              },
            ]
          : [];
      });
      return { ...outcome, meta: { ...outcome.meta, items: items.slice(0, ITEM_LIMIT) } };
    },
  },
  {
    id: 'telegram',
    label: 'Telegram bots',
    group: 'Telegram',
    features: ['Telegram alerts'],
    hint: 'The host must create a new token in BotFather and save it in Notifications.',
    isConfigured: has('GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY'),
    run: async ({ supabase }) => {
      const scopes = await loadTelegramBots(supabase);
      if (scopes === null) return { status: 'unknown', detail: 'Could not read bot settings' };
      const byToken = new Map<string, TelegramBotScope[]>();
      for (const scope of scopes)
        byToken.set(scope.token, [...(byToken.get(scope.token) ?? []), scope]);
      const tokens = [...byToken.keys()].slice(0, TELEGRAM_TOKEN_LIMIT);
      if (tokens.length === 0) return { status: 'off', detail: 'No bots configured' };
      const valid = await Promise.all(
        tokens.map(async (token) => {
          try {
            const { status, body } = await fetchJson(`https://api.telegram.org/bot${token}/getMe`);
            return classifyTelegramGetMe(status, body);
          } catch {
            return null;
          }
        })
      );
      const invalidScopes = tokens.flatMap((token, i) =>
        valid[i] === false ? byToken.get(token)! : []
      );
      const outcome = classifyTelegramBots(valid);
      const items = await describeTelegramScopes(supabase, invalidScopes);
      return { ...outcome, meta: { ...outcome.meta, items } };
    },
  },
  {
    id: 'turnstile',
    console: 'https://dash.cloudflare.com/?to=/:account/turnstile',
    label: 'Turnstile',
    group: 'Security',
    features: ['Public form CAPTCHA'],
    hint: 'Copy the secret key from the Cloudflare Turnstile widget.',
    isConfigured: has('TURNSTILE_SECRET_KEY'),
    run: async ({ get }) => {
      const form = new URLSearchParams({
        secret: get('TURNSTILE_SECRET_KEY') ?? '',
        response: 'system-health-check',
      });
      const { status, body } = await fetchJson(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { method: 'POST', body: form }
      );
      return classifyTurnstile(status, body);
    },
  },
  {
    id: 'jamendo',
    console: 'https://devportal.jamendo.com',
    label: 'Jamendo',
    group: 'Other',
    features: ['Marketing video music'],
    hint: 'Check the client ID in the Jamendo developer portal.',
    isConfigured: has('JAMENDO_CLIENT_ID'),
    run: async ({ get }) => {
      const params = new URLSearchParams({
        client_id: get('JAMENDO_CLIENT_ID') ?? '',
        limit: '1',
        format: 'json',
      });
      const { status, body } = await fetchJson(`https://api.jamendo.com/v3.0/tracks/?${params}`);
      return classifyJamendo(status, body);
    },
  },
  {
    id: 'supabase_auth',
    label: 'Supabase Auth',
    group: 'Core',
    features: ['Host and admin sign-in'],
    hint: 'Enable Google in Supabase Auth providers.',
    isConfigured: has('SUPABASE_URL', 'SUPABASE_ANON_KEY'),
    run: async ({ get }) => {
      const { status, body } = await fetchJson(`${get('SUPABASE_URL')}/auth/v1/settings`, {
        headers: { apikey: get('SUPABASE_ANON_KEY') ?? '' },
      });
      return classifySupabaseAuth(status, body);
    },
  },
];

type TelegramBotScope = {
  token: string;
  channel: string;
  propertyId: string | null;
  parkingId: string | null;
};

const TELEGRAM_TABLES: Array<{ table: string; channel: string; hasProperty: boolean }> = [
  { table: 'telegram_admin_settings', channel: 'Admin alerts', hasProperty: true },
  { table: 'telegram_chat_settings', channel: 'Guest chat', hasProperty: true },
  { table: 'telegram_marketing_settings', channel: 'Marketing', hasProperty: true },
  { table: 'telegram_staff_settings', channel: 'Staff', hasProperty: true },
  { table: 'telegram_finance_settings', channel: 'Finance', hasProperty: true },
  { table: 'telegram_maintenance_settings', channel: 'Maintenance', hasProperty: true },
  { table: 'telegram_parking_settings', channel: 'Parking', hasProperty: false },
];

/** Enabled bots with a saved token, decrypted in memory only. Null when settings are unreadable. */
async function loadTelegramBots(supabase: SupabaseClient): Promise<TelegramBotScope[] | null> {
  const results = await Promise.all(
    TELEGRAM_TABLES.map(({ table, hasProperty }) =>
      supabase
        .from(table)
        .select(
          hasProperty
            ? 'bot_token_encrypted, property_id, parking_id'
            : 'bot_token_encrypted, parking_id'
        )
        .eq('enabled', true)
        .not('bot_token_encrypted', 'is', null)
        .limit(200)
    )
  );
  if (results.some((result) => result.error)) return null;
  const scopes: TelegramBotScope[] = [];
  for (const [i, result] of results.entries()) {
    for (const row of (result.data ?? []) as unknown as Array<Record<string, string | null>>) {
      const token = await decryptPropertySecret(row.bot_token_encrypted).catch(() => null);
      if (!token) continue;
      scopes.push({
        token,
        channel: TELEGRAM_TABLES[i].channel,
        propertyId: row.property_id ?? null,
        parkingId: row.parking_id ?? null,
      });
    }
  }
  return scopes;
}

async function describeTelegramScopes(
  supabase: SupabaseClient,
  scopes: TelegramBotScope[]
): Promise<HealthCheckItem[]> {
  const picked = scopes.slice(0, ITEM_LIMIT);
  if (picked.length === 0) return [];
  const propertyIds = picked.flatMap((s) => (s.propertyId ? [s.propertyId] : []));
  const parkingIds = picked.flatMap((s) => (!s.propertyId && s.parkingId ? [s.parkingId] : []));
  const [props, parks] = await Promise.all([
    propertyIds.length
      ? supabase
          .from('properties')
          .select('id, name, organizations(name, slug)')
          .in('id', propertyIds)
          .limit(propertyIds.length)
      : Promise.resolve({ data: [] }),
    parkingIds.length
      ? supabase
          .from('parkings')
          .select('id, name, organizations(name, slug)')
          .in('id', parkingIds)
          .limit(parkingIds.length)
      : Promise.resolve({ data: [] }),
  ]);
  type Unit = { id: string; name: string; organizations: { name: string; slug: string } | null };
  const units = new Map<string, Unit>(
    [...((props.data ?? []) as Unit[]), ...((parks.data ?? []) as Unit[])].map((u) => [u.id, u])
  );
  return picked.map((scope) => {
    const unit = units.get(scope.propertyId ?? scope.parkingId ?? '');
    return {
      label: `${unit?.organizations?.name ?? 'Unknown org'} · ${unit?.name ?? 'Unknown unit'}`,
      detail: `${scope.channel}: token rejected`,
      href: unit?.organizations?.slug ? `/admin/orgs/${unit.organizations.slug}` : undefined,
    };
  });
}

async function runOne(def: ProbeDef, ctx: ProbeContext): Promise<ProbeResultRow> {
  const started = Date.now();
  let outcome: ProbeOutcome;
  try {
    outcome = await def.run(ctx);
  } catch (err) {
    const timedOut = (err as Error).name === 'TimeoutError';
    outcome = { status: 'warn', detail: timedOut ? 'Timed out' : 'Request failed' };
  }
  return {
    probe_id: def.id,
    status: outcome.status,
    detail: outcome.detail,
    latency_ms: Date.now() - started,
    meta: outcome.meta ?? {},
    checked_at: new Date().toISOString(),
  };
}

/** Runs configured probes not checked in the last 60s; returns every cached row afterward. */
export async function runProbes(
  ctx: ProbeContext,
  requested: string[] | undefined,
  now = Date.now()
): Promise<{ results: ProbeResultRow[]; ran: string[]; throttled: string[] }> {
  const wanted = PROBES.filter(
    (def) => def.isConfigured(ctx.get) && (!requested?.length || requested.includes(def.id))
  );
  const { data: cached } = await ctx.supabase
    .from('system_health_probe_results')
    .select('probe_id, checked_at')
    .limit(PROBES.length);
  const lastRun = new Map<string, number>(
    (cached ?? []).map((row) => [String(row.probe_id), Date.parse(String(row.checked_at))])
  );
  const throttled = wanted
    .filter((def) => now - (lastRun.get(def.id) ?? 0) < PROBE_THROTTLE_MS)
    .map((def) => def.id);
  const toRun = wanted.filter((def) => !throttled.includes(def.id));

  const fresh = await Promise.all(toRun.map((def) => runOne(def, ctx)));
  if (fresh.length > 0) {
    const { error } = await ctx.supabase.from('system_health_probe_results').upsert(fresh);
    if (error) console.warn('[systemHealth] probe upsert failed:', error.message);
  }

  const { data: all } = await ctx.supabase
    .from('system_health_probe_results')
    .select('*')
    .limit(PROBES.length);
  return {
    results: (all ?? []) as ProbeResultRow[],
    ran: toRun.map((def) => def.id),
    throttled,
  };
}

/** Merges cached probe rows into integration checks (unconfigured probes show as `off`). */
export function probesToChecks(get: EnvGet, cached: ProbeResultRow[]): HealthCheck[] {
  const byId = new Map(cached.map((row) => [row.probe_id, row]));
  return PROBES.map((def) => {
    const base = {
      id: `probe.${def.id}`,
      probeId: def.id,
      category: 'integrations' as const,
      group: def.group,
      label: def.label,
      features: def.features,
    };
    if (!def.isConfigured(get))
      return { ...base, status: 'off' as const, detail: 'Not configured' };
    const row = byId.get(def.id);
    if (!row) return { ...base, status: 'unknown' as const, detail: 'Not checked yet' };
    const isProblem = row.status === 'error' || row.status === 'warn';
    const items = Array.isArray(row.meta?.items) ? (row.meta.items as HealthCheckItem[]) : [];
    return {
      ...base,
      status: row.status,
      detail: row.detail ?? undefined,
      hint: isProblem ? def.hint : undefined,
      manageHref: isProblem ? def.console : undefined,
      items: isProblem && items.length ? items : undefined,
      checkedAt: row.checked_at,
    };
  });
}
