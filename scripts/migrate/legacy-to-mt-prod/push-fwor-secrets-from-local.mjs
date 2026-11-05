#!/usr/bin/env bun
/**
 * Push selected edge secrets from supabase/.env.local to fwor (production project).
 * Requires KAMEWAVE=kamewave in the environment (repo policy + shell hooks on deploy paths).
 *
 *   KAMEWAVE=kamewave bun scripts/migrate/legacy-to-mt-prod/push-fwor-secrets-from-local.mjs
 *   KAMEWAVE=kamewave bun ... --dry-run
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSupabaseAccessToken } from './lib/supabaseManagementToken.mjs';

const ROOT = join(import.meta.dir, '..', '..', '..');
const REF = 'fworvijbrwpyngycotbz';
const LOCAL = join(ROOT, 'supabase', '.env.local');
const dryRun = process.argv.includes('--dry-run');

const PUSH_KEYS = [
  'ADMIN_ALLOWED_EMAILS',
  'SUPER_ADMIN_EMAILS',
  'SUPER_ADMIN_VERIFICATION_SECRET',
  'PAYMONGO_WEBHOOK_SECRET',
];

if (process.env.KAMEWAVE !== 'kamewave') {
  console.error('push-fwor-secrets-from-local: set KAMEWAVE=kamewave on the command');
  process.exit(42);
}

const token = resolveSupabaseAccessToken();
if (!token) {
  console.error('push-fwor-secrets-from-local: no sbp_ PAT');
  process.exit(2);
}

function parseEnv(path) {
  const lines = [];
  if (!existsSync(path)) return lines;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (!PUSH_KEYS.includes(key)) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) lines.push(`${key}=${val}`);
  }
  return lines;
}

const pairs = parseEnv(LOCAL);
if (pairs.length === 0) {
  console.error('push-fwor-secrets-from-local: no PUSH_KEYS found in supabase/.env.local');
  process.exit(1);
}

if (dryRun) {
  console.log('push-fwor-secrets-from-local: dry-run would set', pairs.map((p) => p.split('=')[0]).join(', '));
  process.exit(0);
}

const tmp = join(ROOT, 'supabase/.temp/fwor-secrets-push.env');
writeFileSync(tmp, pairs.join('\n') + '\n', { mode: 0o600 });
try {
  execSync(`supabase secrets set --env-file "${tmp}" --project-ref ${REF}`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token, KAMEWAVE: 'kamewave' },
  });
  console.log('push-fwor-secrets-from-local: ok', pairs.map((p) => p.split('=')[0]).join(', '));
} finally {
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}
