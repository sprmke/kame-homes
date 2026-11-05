#!/usr/bin/env bun
/**
 * Phase 6 — compare supabase/.env.local values to fwor hosted digests.
 * Retired legacy-only keys (Gmail listener, Calendar env) are N/A, not failures.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const LOCAL = join(ROOT, 'supabase', '.env.local');
const DIGESTS = join(ROOT, 'backups/legacy-prod-config/20261101/fwor-secrets-digests.json');

/** Keys we expect on fwor for cutover (subset of .env.local). */
const FWOR_KEYS = [
  'ADMIN_ALLOWED_EMAILS',
  'SUPER_ADMIN_EMAILS',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_APPROVAL_INBOUND_DOMAIN',
  'RESEND_INBOUND_WEBHOOK_SECRET',
  'PAYMONGO_SECRET_KEY',
  'PAYMONGO_WEBHOOK_SECRET',
  'GEMINI_API_KEYS',
  'GROQ_API_KEY',
  'TELEGRAM_ADMIN_CRON_SECRET',
  'TELEGRAM_STAFF_CRON_SECRET',
  'TELEGRAM_FINANCE_CRON_SECRET',
  'TELEGRAM_MAINTENANCE_CRON_SECRET',
];

const NA_LEGACY = new Set([
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_SPREADSHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT',
  'GMAIL_API_WEB_CLIENT_JSON',
  'GMAIL_OAUTH_CLIENT_JSON',
  'GMAIL_OAUTH_TOKEN_JSON',
  'GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS',
  'TELEGRAM_ADMIN_BOT_TOKEN',
  'TELEGRAM_ADMIN_CHAT_ID',
  'TELEGRAM_STAFF_BOT_TOKEN',
  'TELEGRAM_STAFF_CHAT_ID',
  'TELEGRAM_FINANCE_BOT_TOKEN',
  'TELEGRAM_FINANCE_CHAT_ID',
  'TELEGRAM_MAINTENANCE_BOT_TOKEN',
  'TELEGRAM_MAINTENANCE_CHAT_ID',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CRON_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PUBLIC_URL',
]);

function parseEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function loadDigests(path) {
  const rows = JSON.parse(readFileSync(path, 'utf8'));
  const out = {};
  for (const row of rows) {
    if (row.name && row.value) out[row.name] = String(row.value).replace(/^sha256:/, '');
  }
  return out;
}

if (!existsSync(DIGESTS)) {
  console.error('verify-fwor-secrets-from-local: run refresh-fwor-secret-digests.mjs first');
  process.exit(2);
}

const local = parseEnv(LOCAL);
const hosted = loadDigests(DIGESTS);
let failures = 0;

for (const key of FWOR_KEYS) {
  const val = local[key];
  if (!val) {
    console.log(`skip: ${key} (not in .env.local)`);
    continue;
  }
  const hostDig = hosted[key];
  if (!hostDig) {
    console.log(`fail: ${key} missing on fwor`);
    failures++;
    continue;
  }
  if (digest(val) === hostDig) console.log(`ok: ${key}`);
  else {
    console.log(`fail: ${key} mismatch (local vs fwor hosted)`);
    failures++;
  }
}

console.log('verify-fwor-secrets-from-local: N/A legacy keys (telegram bots in DB, Gmail retired):');
for (const key of NA_LEGACY) console.log(`  n/a: ${key}`);

process.exit(failures > 0 ? 1 : 0);
