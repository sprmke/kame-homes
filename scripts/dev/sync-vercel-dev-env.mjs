#!/usr/bin/env bun
/**
 * Push UI hosted-dev env vars to Vercel project `kame-homes`.
 *
 * Requires `vercel login` on an account with access to kame-works/kame-homes.
 *
 * Usage:
 *   bun scripts/dev/sync-vercel-dev-env.mjs [--dry-run] [--production-too]
 *
 * Default targets: preview + development. Pass --production-too to include Production.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVercelAuth, readEnvFile, vercelUpsertEnv } from './env-sync-lib.mjs';

const ROOT = join(import.meta.dir, '../..');
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_PRODUCTION = process.argv.includes('--production-too');

const UI_KEYS = [
  'VITE_NODE_ENV',
  'VITE_SUPABASE_URL',
  'VITE_API_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_PLATFORM_APP_NAME',
  'VITE_PLATFORM_CONTACT_EMAIL',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_TURNSTILE_SITE_KEY',
  'VITE_POSTHOG_KEY',
  'VITE_POSTHOG_HOST',
  'VITE_VAPID_PUBLIC_KEY',
  'POSTHOG_PERSONAL_API_KEY',
  'POSTHOG_PROJECT_ID',
];

const auth = loadVercelAuth(ROOT);
if (!auth) {
  console.error('Vercel CLI not authenticated or .vercel/project.json missing.');
  console.error('Run: npx vercel@latest login');
  process.exit(1);
}

const hostedPath = join(ROOT, 'ui/.env.development.dev');
const rootPath = join(ROOT, 'ui/.env');
if (!existsSync(hostedPath)) {
  console.error(`Missing ${hostedPath}`);
  process.exit(1);
}

const hosted = readEnvFile(hostedPath);
const shared = readEnvFile(rootPath);

const values = new Map();
for (const key of UI_KEYS) {
  const v = hosted.get(key)?.trim() || shared.get(key)?.trim();
  if (v) values.set(key, v);
}

const targets = ['preview', 'development'];
if (INCLUDE_PRODUCTION) targets.push('production');

console.log(
  `Vercel sync → ${auth.projectName} (${targets.join(', ')}): ${values.size} key(s)${DRY_RUN ? ' [dry-run]' : ''}`
);

if (DRY_RUN) {
  for (const [key] of values) console.log(`  would set ${key}`);
  process.exit(0);
}

let ok = 0;
let fail = 0;
for (const [key, value] of values) {
  const result = await vercelUpsertEnv(auth, key, value, targets);
  if (result.ok) {
    ok += 1;
    console.log(`OK ${key} (${result.status})`);
  } else {
    fail += 1;
    const err = result.payload?.error ?? result.payload;
    console.error(`FAIL ${key} (${result.status})`, err);
  }
}

console.log(`\n${ok} ok, ${fail} failed. Verify: npx vercel@latest env ls`);
if (fail > 0) process.exit(1);
