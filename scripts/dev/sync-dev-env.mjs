#!/usr/bin/env bun
/**
 * Sync local secrets → hosted multi-tenant DEV (linked Supabase project fwor…).
 *
 * 1. Merge shared edge secrets from supabase/.env.local into supabase/.env.dev.local
 * 2. Align ui/.env.development.dev with hosted-dev branding / observability / PWA keys
 * 3. Push edge secrets to linked Supabase (DEV)
 * 4. Unset legacy Google/Gmail secrets migrated to DB
 *
 * Usage:
 *   bun scripts/dev/sync-dev-env.mjs [--dry-run] [--skip-remote] [--skip-local]
 *
 * Does NOT touch Vercel (requires a valid `vercel login`) or LEGACY/prod Supabase.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POSTHOG_UI_TO_EDGE,
  UI_SHARED_KEYS,
  readEnvFile,
  setAlways,
  setIfMissing,
  writeSectionedEnvSync,
} from './env-sync-lib.mjs';

const ROOT = join(import.meta.dir, '../..');
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_REMOTE = process.argv.includes('--skip-remote');
const SKIP_LOCAL = process.argv.includes('--skip-local');

const DEV_REF = 'fworvijbrwpyngycotbz';
const DEV_ORIGIN = 'https://dev.kamehomes.space';
const DEV_SUPABASE_URL = `https://${DEV_REF}.supabase.co`;

/** Keys that belong on hosted DEV edge secrets (copied from .env.local when missing). */
const DEV_EDGE_FROM_LOCAL = [
  'ENVIRONMENT',
  'ADMIN_ALLOWED_EMAILS',
  'SUPER_ADMIN_EMAILS',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_INBOUND_WEBHOOK_SECRET',
  'RESEND_APPROVAL_INBOUND_DOMAIN',
  'SUPPORT_TEAM_EMAIL',
  'GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY',
  'SETTINGS_VERIFICATION_SECRET',
  'SUPER_ADMIN_VERIFICATION_SECRET',
  'TURNSTILE_SECRET_KEY',
  'CAPTCHA_MODE',
  'FACEBOOK_REVIEWS_URL',
  'AIRBNB_URL',
  'INSTAGRAM_URL',
  'TIKTOK_URL',
  'GEMINI_API_KEYS',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_INBOX_TOKEN_ENCRYPTION_KEY',
  'META_WEBHOOK_VERIFY_TOKEN',
  'META_OAUTH_EXCLUDE_PUBLISHING_SCOPES',
  'META_OAUTH_EXTRA_SCOPES',
  'PAYMONGO_SECRET_KEY',
  'PAYMONGO_WEBHOOK_SECRET',
  'JAMENDO_CLIENT_ID',
  'POSTHOG_API_KEY',
  'POSTHOG_HOST',
  'VAPID_KEYS',
  'VAPID_SUBJECT',
  'PUSH_FANOUT_SECRET',
  'PLATFORM_APP_NAME',
  'SD_REFUND_CRON_SECRET',
  'TELEGRAM_CRON_SECRET',
  'TELEGRAM_STAFF_CRON_SECRET',
  'TELEGRAM_ADMIN_CRON_SECRET',
  'TELEGRAM_FINANCE_CRON_SECRET',
  'TELEGRAM_MAINTENANCE_CRON_SECRET',
  'PARKING_BROADCAST_EXPIRE_CRON_SECRET',
  'PARKING_REMINDER_CRON_SECRET',
  'CONTRACT_EXPIRY_CRON_SECRET',
  'DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET',
  'META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET',
  'PLATFORM_BILLING_CRON_SECRET',
  'CALENDAR_SYNC_CRON_SECRET',
  'SMART_PRICING_CRON_SECRET',
  'SUPERHOST_ASSESSMENT_CRON_SECRET',
  'ANALYTICS_AI_REVIEW_CRON_SECRET',
  'PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET',
  'ACTIVITY_LOG_RETENTION_CRON_SECRET',
];

/** Never push to hosted DEV from local-only ngrok / override paths. */
const NEVER_PUSH_TO_REMOTE = new Set([
  'PROD_DB_URL',
  'DEV_DB_URL',
  'DEV_PROJECT_REF',
  'DEV_SUPABASE_URL',
  'DEV_SERVICE_ROLE_KEY',
  'PROD_PROJECT_REF',
  'GEMINI_MODEL_OVERRIDE',
  'GEMINI_MODEL_OVERRIDE_DASHBOARD_ASSISTANT',
  'PLATFORM_CONTACT_EMAIL',
  // Local ngrok aliases — hosted uses PUBLIC_API_URL = DEV_SUPABASE_URL
  'SUPABASE_PUBLIC_URL',
]);

const LEGACY_REMOTE_UNSET = [
  'GMAIL_API_WEB_CLIENT_JSON',
  'GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_SERVICE_ACCOUNT',
  'GOOGLE_SPREADSHEET_ID',
];

/** Copied from .env.local → .env.dev.local with setAlways (not only when missing). */
const EDGE_ALWAYS_FROM_LOCAL = new Set([
  'TURNSTILE_SECRET_KEY',
  'POSTHOG_API_KEY',
  'POSTHOG_HOST',
]);

const UI_SECTIONS_HOSTED = [
  { title: 'App', keys: ['VITE_NODE_ENV'] },
  {
    title: 'Supabase',
    keys: ['VITE_SUPABASE_URL', 'VITE_API_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PROJECT_URL'],
  },
  {
    title: 'Platform branding (UI only)',
    keys: ['VITE_PLATFORM_APP_NAME', 'VITE_PLATFORM_CONTACT_EMAIL'],
  },
  { title: 'Maps', keys: ['VITE_GOOGLE_MAPS_API_KEY'] },
  { title: 'Observability', keys: ['VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST'] },
  { title: 'PWA', keys: ['VITE_VAPID_PUBLIC_KEY'] },
  { title: 'Anti-spam', keys: ['VITE_TURNSTILE_SITE_KEY'] },
];

/** Propagate shared UI keys across development env files (ui/.env stays PostHog-only). */
function mergeUiShared() {
  const uiRootPath = join(ROOT, 'ui/.env');
  const uiDevPath = join(ROOT, 'ui/.env.development');
  const uiHostedPath = join(ROOT, 'ui/.env.development.dev');

  const uiRoot = readEnvFile(uiRootPath);
  const uiDev = readEnvFile(uiDevPath);
  const uiHosted = readEnvFile(uiHostedPath);
  const changes = [];

  const posthogKeys = ['VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST'];
  for (const key of posthogKeys) {
    const canonical =
      uiRoot.get(key)?.trim() || uiDev.get(key)?.trim() || uiHosted.get(key)?.trim() || '';
    if (!canonical) continue;
    for (const [label, map] of [
      ['ui/.env', uiRoot],
      ['ui/.env.development', uiDev],
      ['ui/.env.development.dev', uiHosted],
    ]) {
      const r = setAlways(map, key, canonical);
      if (r) changes.push(`${label}: ${r} ${key}`);
    }
  }

  const devOnlyKeys = UI_SHARED_KEYS.filter((k) => !posthogKeys.includes(k));
  for (const key of devOnlyKeys) {
    const canonical =
      uiDev.get(key)?.trim() || uiHosted.get(key)?.trim() || uiRoot.get(key)?.trim() || '';
    if (!canonical) continue;
    for (const [label, map] of [
      ['ui/.env.development', uiDev],
      ['ui/.env.development.dev', uiHosted],
    ]) {
      const r = setAlways(map, key, canonical);
      if (r) changes.push(`${label}: ${r} ${key}`);
    }
  }

  if (!SKIP_LOCAL && !DRY_RUN) {
    if (existsSync(uiRootPath)) {
      writeSectionedEnvSync(
        uiRootPath,
        [{ title: 'Observability (all modes)', keys: posthogKeys }],
        uiRoot,
        DRY_RUN
      );
    }
    if (existsSync(uiHostedPath)) {
      writeSectionedEnvSync(uiHostedPath, UI_SECTIONS_HOSTED, uiHosted, DRY_RUN);
    }
  }

  console.log(`mergeUiShared: ${changes.length} field(s) aligned`);
  for (const c of changes) console.log(`  - ${c}`);
}

/** Mirror VITE_POSTHOG_* → POSTHOG_* on supabase/.env.local (mergeDevLocal copies to .env.dev.local). */
function syncPosthogToEdge() {
  const uiRoot = readEnvFile(join(ROOT, 'ui/.env'));
  const uiDev = readEnvFile(join(ROOT, 'ui/.env.development'));
  const posthogKey =
    uiRoot.get('VITE_POSTHOG_KEY')?.trim() || uiDev.get('VITE_POSTHOG_KEY')?.trim() || '';
  const posthogHost =
    uiRoot.get('VITE_POSTHOG_HOST')?.trim() || uiDev.get('VITE_POSTHOG_HOST')?.trim() || '';
  if (!posthogKey && !posthogHost) return;

  const localPath = join(ROOT, 'supabase/.env.local');
  if (!existsSync(localPath)) return;
  const map = readEnvFile(localPath);
  const changes = [];
  if (posthogKey) {
    const r = setAlways(map, POSTHOG_UI_TO_EDGE.VITE_POSTHOG_KEY, posthogKey);
    if (r) changes.push(`${r} POSTHOG_API_KEY`);
  }
  if (posthogHost) {
    const r = setAlways(map, POSTHOG_UI_TO_EDGE.VITE_POSTHOG_HOST, posthogHost);
    if (r) changes.push(`${r} POSTHOG_HOST`);
  }
  if (changes.length) {
    console.log('syncPosthogToEdge (supabase/.env.local):');
    for (const c of changes) console.log(`  - ${c}`);
  }
  // Patch .env.local in place; mergeDevLocal + reorganize finish formatting.
  if (!SKIP_LOCAL && !DRY_RUN && changes.length > 0) {
    let raw = readFileSync(localPath, 'utf8');
    for (const [k, v] of [
      ['POSTHOG_API_KEY', posthogKey],
      ['POSTHOG_HOST', posthogHost],
    ]) {
      if (!v) continue;
      if (new RegExp(`^${k}=`, 'm').test(raw)) {
        raw = raw.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`);
      }
    }
    writeFileSync(localPath, raw);
  }
}

function mergeDevLocal() {
  const localPath = join(ROOT, 'supabase/.env.local');
  const devPath = join(ROOT, 'supabase/.env.dev.local');
  const local = readEnvFile(localPath);
  const dev = readEnvFile(devPath);

  const changes = [];

  // Force hosted-dev URL / origin shape
  for (const [key, value, label] of [
    ['DEV_PROJECT_REF', DEV_REF, 'dev ref'],
    ['DEV_SUPABASE_URL', DEV_SUPABASE_URL, 'dev url'],
    ['PUBLIC_API_URL', DEV_SUPABASE_URL, 'public api'],
    ['PUBLIC_GUEST_APP_ORIGIN', DEV_ORIGIN, 'guest origin'],
    ['ENVIRONMENT', 'development', 'environment'],
  ]) {
    const r = setAlways(dev, key, value);
    if (r) changes.push(`${r} ${key} (${label})`);
  }

  // Meta OAuth return origins must include hosted-dev SPA
  const metaOrigins =
    'http://127.0.0.1:5173,http://localhost:5173,https://dev.kamehomes.space';
  const rMeta = setAlways(dev, 'META_OAUTH_ALLOWED_RETURN_ORIGINS', metaOrigins);
  if (rMeta) changes.push(`${rMeta} META_OAUTH_ALLOWED_RETURN_ORIGINS`);

  for (const key of DEV_EDGE_FROM_LOCAL) {
    const fromLocal = local.get(key)?.trim();
    if (!fromLocal) continue;
    const r = EDGE_ALWAYS_FROM_LOCAL.has(key)
      ? setAlways(dev, key, fromLocal)
      : setIfMissing(dev, key, fromLocal);
    if (r) changes.push(`${r} ${key} from .env.local`);
  }

  // Drop misplaced UI-only key if present
  if (dev.has('PLATFORM_CONTACT_EMAIL')) {
    dev.delete('PLATFORM_CONTACT_EMAIL');
    changes.push('removed PLATFORM_CONTACT_EMAIL (UI-only → VITE_PLATFORM_CONTACT_EMAIL)');
  }

  const sections = [
    {
      title: 'Dev project',
      keys: ['DEV_PROJECT_REF', 'DEV_SUPABASE_URL', 'DEV_SERVICE_ROLE_KEY', 'PROD_PROJECT_REF'],
    },
    { title: 'Scripts', keys: ['DEV_DB_URL'] },
    { title: 'Env', keys: ['ENVIRONMENT', 'DENO_ENV'] },
    { title: 'URLs', keys: ['PUBLIC_GUEST_APP_ORIGIN', 'PUBLIC_API_URL', 'SUPABASE_PUBLIC_URL'] },
    { title: 'Auth', keys: ['ADMIN_ALLOWED_EMAILS', 'SUPER_ADMIN_EMAILS'] },
    {
      title: 'Email',
      keys: [
        'RESEND_API_KEY',
        'RESEND_FROM_EMAIL',
        'RESEND_INBOUND_WEBHOOK_SECRET',
        'RESEND_APPROVAL_INBOUND_DOMAIN',
        'SUPPORT_TEAM_EMAIL',
      ],
    },
    {
      title: 'Crypto',
      keys: [
        'GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY',
        'SETTINGS_VERIFICATION_SECRET',
        'SUPER_ADMIN_VERIFICATION_SECRET',
      ],
    },
    { title: 'Anti-spam', keys: ['TURNSTILE_SECRET_KEY', 'CAPTCHA_MODE'] },
    {
      title: 'Social fallbacks',
      keys: ['FACEBOOK_REVIEWS_URL', 'AIRBNB_URL', 'INSTAGRAM_URL', 'TIKTOK_URL'],
    },
    { title: 'AI', keys: ['GEMINI_API_KEYS', 'GEMINI_API_KEY', 'GROQ_API_KEY'] },
    {
      title: 'Meta',
      keys: [
        'META_APP_ID',
        'META_APP_SECRET',
        'META_INBOX_TOKEN_ENCRYPTION_KEY',
        'META_WEBHOOK_VERIFY_TOKEN',
        'META_OAUTH_ALLOWED_RETURN_ORIGINS',
        'META_OAUTH_EXCLUDE_PUBLISHING_SCOPES',
        'META_OAUTH_EXTRA_SCOPES',
      ],
    },
    { title: 'PayMongo', keys: ['PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET'] },
    { title: 'Jamendo', keys: ['JAMENDO_CLIENT_ID'] },
    { title: 'Observability', keys: ['POSTHOG_API_KEY', 'POSTHOG_HOST'] },
    { title: 'PWA Web Push', keys: ['VAPID_KEYS', 'VAPID_SUBJECT', 'PUSH_FANOUT_SECRET'] },
    { title: 'Platform email branding', keys: ['PLATFORM_APP_NAME'] },
    {
      title: 'Cron secrets',
      keys: [
        'SD_REFUND_CRON_SECRET',
        'TELEGRAM_CRON_SECRET',
        'TELEGRAM_STAFF_CRON_SECRET',
        'TELEGRAM_ADMIN_CRON_SECRET',
        'TELEGRAM_FINANCE_CRON_SECRET',
        'TELEGRAM_MAINTENANCE_CRON_SECRET',
        'PARKING_BROADCAST_EXPIRE_CRON_SECRET',
        'PARKING_REMINDER_CRON_SECRET',
        'CONTRACT_EXPIRY_CRON_SECRET',
        'DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET',
        'META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET',
        'PLATFORM_BILLING_CRON_SECRET',
        'CALENDAR_SYNC_CRON_SECRET',
        'SMART_PRICING_CRON_SECRET',
        'SUPERHOST_ASSESSMENT_CRON_SECRET',
        'ANALYTICS_AI_REVIEW_CRON_SECRET',
        'PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET',
        'ACTIVITY_LOG_RETENTION_CRON_SECRET',
      ],
    },
  ];

  if (!SKIP_LOCAL) {
    writeSectionedEnvSync(devPath, sections, dev, DRY_RUN);
    console.log(
      `${DRY_RUN ? 'would update' : 'updated'} supabase/.env.dev.local (${changes.length} field changes)`
    );
    for (const c of changes) console.log(`  - ${c}`);
  }

  return dev;
}

function mergeUiDev() {
  const uiDevPath = join(ROOT, 'ui/.env.development');
  const uiHostedPath = join(ROOT, 'ui/.env.development.dev');
  const uiRoot = join(ROOT, 'ui/.env');
  const local = readEnvFile(uiDevPath);
  const hosted = readEnvFile(uiHostedPath);
  const shared = readEnvFile(uiRoot);
  const changes = [];

  setAlways(hosted, 'VITE_NODE_ENV', 'development');
  setAlways(hosted, 'VITE_SUPABASE_URL', `${DEV_SUPABASE_URL}/functions/v1`);
  setAlways(hosted, 'VITE_API_URL', `${DEV_SUPABASE_URL}/functions/v1`);

  for (const key of UI_SHARED_KEYS) {
    const src = shared.get(key)?.trim() || local.get(key)?.trim() || hosted.get(key)?.trim();
    if (!src) continue;
    const r = setAlways(hosted, key, src);
    if (r) changes.push(`${r} ${key}`);
  }

  // Prefer existing hosted anon key (must match fwor…)
  if (!hosted.get('VITE_SUPABASE_ANON_KEY')?.trim()) {
    const anon = local.get('VITE_SUPABASE_ANON_KEY')?.trim();
    if (anon) {
      const r = setAlways(hosted, 'VITE_SUPABASE_ANON_KEY', anon);
      if (r) changes.push(`${r} VITE_SUPABASE_ANON_KEY`);
    }
  }

  if (!SKIP_LOCAL) {
    writeSectionedEnvSync(uiHostedPath, UI_SECTIONS_HOSTED, hosted, DRY_RUN);
    console.log(
      `${DRY_RUN ? 'would update' : 'updated'} ui/.env.development.dev (${changes.length} field changes)`
    );
    for (const c of changes) console.log(`  - ${c}`);
  }

  return hosted;
}

/** @param {Map<string, string>} dev */
function pushSupabaseSecrets(dev) {
  if (SKIP_REMOTE) {
    console.log('skip remote supabase secrets');
    return;
  }

  // Confirm linked project is DEV
  const status = spawnSync('bun', ['run', 'env:status'], { cwd: ROOT, encoding: 'utf8' });
  const out = `${status.stdout}\n${status.stderr}`;
  if (!out.includes(DEV_REF) || !out.includes('(dev)')) {
    console.error('Refusing remote secret push — linked project is not multi-tenant DEV:');
    console.error(out.trim());
    process.exit(1);
  }

  const tmpDir = join(ROOT, 'supabase/.temp');
  mkdirSync(tmpDir, { recursive: true });
  const envFile = join(tmpDir, 'dev-secrets-push.env');

  const lines = [];
  for (const [key, value] of [...dev.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (NEVER_PUSH_TO_REMOTE.has(key)) continue;
    if (key.startsWith('DEV_') || key.startsWith('PROD_') || key.startsWith('MT_')) continue;
    if (!value?.trim()) continue;
    const needsQuotes = /[\s#"'\\]/.test(value) || value.includes(',');
    lines.push(needsQuotes ? `${key}='${value.replace(/'/g, "'\\''")}'` : `${key}=${value}`);
  }
  writeFileSync(envFile, `${lines.join('\n')}\n`, 'utf8');
  console.log(`prepared ${lines.length} secrets → ${envFile}`);

  if (DRY_RUN) {
    console.log('dry-run: would run supabase secrets set --env-file …');
    console.log(`dry-run: would unset ${LEGACY_REMOTE_UNSET.join(', ')}`);
    return;
  }

  const setRes = spawnSync('supabase', ['secrets', 'set', '--env-file', envFile], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  console.log(setRes.stdout || '');
  if (setRes.status !== 0) {
    console.error(setRes.stderr || 'secrets set failed');
    process.exit(setRes.status ?? 1);
  }

  const listRes = spawnSync('supabase', ['secrets', 'list', '--output', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  let toUnset = LEGACY_REMOTE_UNSET;
  if (listRes.status === 0 && listRes.stdout) {
    try {
      const remote = new Set(JSON.parse(listRes.stdout).map((row) => row.name));
      toUnset = LEGACY_REMOTE_UNSET.filter((name) => remote.has(name));
    } catch {
      // keep full list
    }
  }
  if (toUnset.length > 0) {
    const unsetRes = spawnSync('supabase', ['secrets', 'unset', '--yes', ...toUnset], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    console.log(unsetRes.stdout || '');
    if (unsetRes.status !== 0) {
      console.warn(unsetRes.stderr || 'secrets unset had errors (some may already be gone)');
    }
  } else {
    console.log('no legacy Supabase secrets to unset');
  }

  console.log('Supabase DEV secrets synced.');
}

console.log(`sync-dev-env ${DRY_RUN ? '(dry-run)' : ''}`);
mergeUiShared();
syncPosthogToEdge();
const dev = mergeDevLocal();
mergeUiDev();

// Reorganize local/edge files to drop denylisted keys (PLATFORM_CONTACT_EMAIL, etc.)
if (!SKIP_LOCAL && !DRY_RUN) {
  const reorg = spawnSync('bun', ['scripts/dev/reorganize-env-files.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  console.log(reorg.stdout || '');
  if (reorg.stderr) console.warn(reorg.stderr);
}

pushSupabaseSecrets(dev);
