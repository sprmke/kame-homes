#!/usr/bin/env bun
/**
 * Read-only environment audit.
 *
 *   bun run env:audit                 # local files + code coverage
 *   bun run env:audit -- --hosted     # also compare against the hosted Supabase project
 *   bun run env:audit -- --vercel     # also compare against the Vercel project env
 *   bun run env:audit -- --hosted --vercel --json
 *
 * It never writes and never prints a secret value: hosted secrets are compared by
 * sha256, and the report only carries key names, levels and counts.
 *
 * Exit code 1 when a FAIL row is found (missing required key, local file holding a
 * production value, code key missing from the health registry).
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(import.meta.dir, '../..');
const args = new Set(process.argv.slice(2));
const WANT_HOSTED = args.has('--hosted');
const WANT_VERCEL = args.has('--vercel');
const JSON_OUT = args.has('--json');

const results = [];
function add(level, code, message, items = []) {
  results.push({ level, code, message, items });
}
const pass = (code, message) => add('PASS', code, message);
const warn = (code, message, items = []) => add('WARN', code, message, items);
const fail = (code, message, items = []) => add('FAIL', code, message, items);

function readEnvFile(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function rg(pattern, paths, excludes = []) {
  const globArgs = excludes.flatMap((glob) => ['--glob', `!${glob}`]);
  const res = spawnSync(
    'rg',
    [
      '-o',
      '--no-filename',
      '--no-messages',
      pattern.source ?? String(pattern),
      ...paths,
      ...globArgs,
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  return res.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Registries (the health page is the contract)
// ---------------------------------------------------------------------------
const edgeRegistry = await import(
  join(ROOT, 'supabase/functions/_shared/systemHealth/envRegistry.ts')
);
const jobsRegistry = await import(
  join(ROOT, 'supabase/functions/_shared/systemHealth/jobsRegistry.ts')
);
const EDGE_ENV_REGISTRY = edgeRegistry.EDGE_ENV_REGISTRY;
const edgeKeys = new Set();
for (const def of EDGE_ENV_REGISTRY) {
  for (const key of def.anyOf ?? [def.key]) edgeKeys.add(key);
}

const uiRegistryText = readFileSync(
  join(ROOT, 'ui/src/features/dashboard/super-admin/lib/systemHealth/uiEnvRegistry.ts'),
  'utf8'
);
const uiDefs = [];
for (const match of uiRegistryText.matchAll(
  /\{\s*key: '(VITE_[A-Z0-9_]+)',\s*group: '([^']+)',\s*level: '([A-Za-z]+)'/g
)) {
  uiDefs.push({ key: match[1], group: match[2], level: match[3] });
}
const uiSocialBlock = uiRegistryText.match(/\.\.\.\[\s*([\s\S]*?)\]\.map/);
if (uiSocialBlock) {
  for (const key of uiSocialBlock[1].matchAll(/'(VITE_[A-Z0-9_]+)'/g)) {
    uiDefs.push({ key: key[1], group: 'Branding', level: 'optional' });
  }
}
const uiKeys = new Set(uiDefs.map((def) => def.key));

// ---------------------------------------------------------------------------
// Code usage
// ---------------------------------------------------------------------------
const edgeUsed = new Set(
  rg(
    /Deno\.env\.get\(['"][A-Z0-9_]+['"]/,
    ['supabase/functions'],
    ['**/tests/**', '**/*_test.ts', '**/*.test.ts']
  ).map((line) => line.replace(/^Deno\.env\.get\(['"]/, '').replace(/['"]$/, ''))
);
const uiUsed = new Set(
  rg(/import\.meta\.env\.VITE_[A-Z0-9_]+/, ['ui/src'], ['**/*.test.*']).map((line) =>
    line.replace(/^import\.meta\.env\./, '')
  )
);

/** Read by the platform, not configured by an operator. */
const PLATFORM_KEYS = new Set([
  'API_URL',
  'SERVICE_ROLE_KEY',
  'DENO_DEPLOYMENT_ID',
  'DENO_ENV',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
]);
/** Read only by posture rules / health checks, so no separate env row is expected. */
const POSTURE_ONLY = new Set([
  'CAPTCHA_MODE',
  'EDGE_INLINE_BACKGROUND_TASKS',
  'EDGE_LOG_DEBUG',
  'GEMINI_MODEL_OVERRIDE',
  'GUEST_BOOKING_ACCESS_ENFORCE',
  'META_OAUTH_EXCLUDE_PUBLISHING_SCOPES',
  'AI_RESPONSE_CACHE_DISABLED',
]);
/** UI posture flags read by `readUiEnv` for the Production posture group. */
const UI_POSTURE_ONLY = new Set([
  'VITE_NODE_ENV',
  'VITE_INBOX_MOCK_DATA',
  'VITE_DISABLE_IMAGE_OPTIMIZATION',
  'VITE_PWA_DEV',
]);

const unregisteredEdge = [...edgeUsed].filter(
  (key) => !edgeKeys.has(key) && !PLATFORM_KEYS.has(key) && !POSTURE_ONLY.has(key)
);
const unregisteredUi = [...uiUsed].filter((key) => !uiKeys.has(key) && !UI_POSTURE_ONLY.has(key));
if (unregisteredEdge.length === 0 && unregisteredUi.length === 0) {
  pass('registry.coverage', 'Every code-read env key has a health registry row');
} else {
  fail('registry.coverage', 'Code reads env keys that the health page does not know about', [
    ...unregisteredEdge.map((key) => `edge: ${key}`),
    ...unregisteredUi.map((key) => `ui: ${key}`),
  ]);
}

/** Read indirectly (helper takes the key name), so the literal grep cannot see them. */
const INDIRECT_KEYS = new Set([
  'SUPABASE_ANON_KEY',
  'FACEBOOK_REVIEWS_URL',
  'AIRBNB_URL',
  'INSTAGRAM_URL',
  'TIKTOK_URL',
]);
const cronSecretKeys = new Set((jobsRegistry.SCHEDULED_JOBS ?? []).map((job) => job.secretEnv));
const unusedEdge = EDGE_ENV_REGISTRY.filter(
  (def) =>
    !(def.anyOf ?? [def.key]).some((key) => edgeUsed.has(key)) &&
    !INDIRECT_KEYS.has(def.key) &&
    !cronSecretKeys.has(def.key)
).map((def) => def.key);
if (unusedEdge.length === 0) {
  pass('registry.unused', 'No registry row points at a key nothing reads');
} else {
  warn('registry.unused', 'Registry rows for keys no handler reads', unusedEdge);
}

// ---------------------------------------------------------------------------
// Local file shape
// ---------------------------------------------------------------------------
const localEdge = readEnvFile(join(ROOT, 'supabase/.env.local'));
const management = readEnvFile(join(ROOT, 'supabase/.env.management.local'));
const hostedEdge = readEnvFile(join(ROOT, 'supabase/.env.dev.local'));
const uiLocal = readEnvFile(join(ROOT, 'ui/.env.development'));
const uiLocalOverrides = readEnvFile(join(ROOT, 'ui/.env.development.local'));

const LOCAL_ONLY_SCRIPT_KEYS = [
  'PROD_DB_URL',
  'VERCEL_TOKEN',
  'SUPABASE_ACCESS_TOKEN',
  'SENTRY_AUTH_TOKEN',
  'POSTHOG_PERSONAL_API_KEY',
  'TARGET_DB_PASSWORD',
  'TARGET_SERVICE_ROLE_KEY',
  'LEGACY_SERVICE_ROLE_KEY',
  'LEGACY_OBJECT_BASE_URL',
];
const leakedIntoRuntime = LOCAL_ONLY_SCRIPT_KEYS.filter((key) => localEdge.has(key));
if (leakedIntoRuntime.length === 0) {
  pass('local.shape', 'supabase/.env.local holds runtime keys only');
} else {
  warn(
    'local.shape',
    'Script-only credentials are in the runtime env file (move to .env.management.local)',
    leakedIntoRuntime
  );
}

const uiProdKeysInDev = ['VITE_POSTHOG_KEY', 'VITE_SENTRY_DSN'].filter((key) =>
  (uiLocal.get(key) ?? uiLocalOverrides.get(key) ?? '').trim()
);
if (uiProdKeysInDev.length === 0) {
  pass('local.ui', 'Local UI build sends no analytics or error telemetry');
} else {
  warn('local.ui', 'Local UI build talks to a hosted telemetry project', uiProdKeysInDev);
}

// ---------------------------------------------------------------------------
// Hosted Supabase (sha256 comparison — values are never returned)
// ---------------------------------------------------------------------------
async function hostedSecrets() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || management.get('SUPABASE_ACCESS_TOKEN') || '';
  const ref =
    hostedEdge.get('DEV_PROJECT_REF') ||
    readEnvFile(join(ROOT, 'supabase/.env.prod.local')).get('TARGET_DB_REF') ||
    '';
  if (!token || !ref) return null;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { error: `Supabase API ${res.status}`, ref };
  const rows = await res.json();
  return { ref, secrets: new Map(rows.map((row) => [row.name, row.value])) };
}

if (WANT_HOSTED) {
  const hosted = await hostedSecrets();
  if (!hosted || hosted.error) {
    warn('hosted.api', `Could not read hosted secrets: ${hosted?.error ?? 'missing token/ref'}`);
  } else {
    const missing = EDGE_ENV_REGISTRY.filter((def) => {
      if (
        ['required', 'prodRequired', 'prodRecommended', 'recommended'].includes(def.level) === false
      ) {
        return false;
      }
      return !(def.anyOf ?? [def.key]).some((key) => hosted.secrets.has(key));
    }).map((def) => `${def.key} (${def.level})`);
    if (missing.length === 0) {
      pass('hosted.missing', `${hosted.ref}: every required and recommended edge secret is set`);
    } else {
      fail(
        'hosted.missing',
        `${hosted.ref}: edge secrets missing from the hosted project`,
        missing
      );
    }

    const NON_SECRET = new Set([
      'ENVIRONMENT',
      'PUBLIC_GUEST_APP_ORIGIN',
      'PUBLIC_API_URL',
      'SUPABASE_PUBLIC_URL',
      'CORS_ALLOWED_ORIGINS',
      'PLATFORM_APP_NAME',
      'RESEND_FROM_EMAIL',
      'SUPPORT_TEAM_EMAIL',
      'RESEND_APPROVAL_INBOUND_DOMAIN',
      'VAPID_SUBJECT',
      'FACEBOOK_REVIEWS_URL',
      'AIRBNB_URL',
      'INSTAGRAM_URL',
      'TIKTOK_URL',
      'CAPTCHA_MODE',
      'GUEST_BOOKING_ACCESS_ENFORCE',
      'GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS',
      'CALENDAR_SYNC_MIN_INTERVAL_MINUTES',
      'AI_ASSISTANT_ATTACHMENT_RETENTION_DAYS',
      'AI_PLATFORM_DAILY_COST_USD_CAP',
      'SENTRY_SAMPLE_RATE_WARNING',
    ]);
    const leaks = [];
    for (const [key, value] of localEdge) {
      if (!value || NON_SECRET.has(key) || key.endsWith('_EMAILS')) continue;
      const remote = hosted.secrets.get(key);
      if (remote && (remote === value || remote === sha256(value))) leaks.push(key);
    }
    if (leaks.length === 0) {
      pass('hosted.leak', 'No production secret value is reused in supabase/.env.local');
    } else {
      fail('hosted.leak', 'supabase/.env.local reuses production values', leaks);
    }
  }
}

// ---------------------------------------------------------------------------
// Vercel (production target)
// ---------------------------------------------------------------------------
if (WANT_VERCEL) {
  const token =
    process.env.VERCEL_TOKEN ||
    management.get('VERCEL_TOKEN') ||
    readEnvFile(join(ROOT, 'supabase/.env.local')).get('VERCEL_TOKEN') ||
    '';
  const projectPath = join(ROOT, '.vercel/project.json');
  if (!token || !existsSync(projectPath)) {
    warn('vercel.api', 'Could not read Vercel env: missing VERCEL_TOKEN or .vercel/project.json');
  } else {
    const project = JSON.parse(readFileSync(projectPath, 'utf8'));
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${project.projectId}?teamId=${project.orgId}&decrypt=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      warn('vercel.api', `Vercel API ${res.status}`);
    } else {
      const data = await res.json();
      const envs = data.env ?? [];
      const prodKeys = new Set();
      const duplicates = new Map();
      for (const entry of envs) {
        if (!(entry.target ?? []).includes('production')) continue;
        prodKeys.add(entry.key);
        duplicates.set(entry.key, (duplicates.get(entry.key) ?? 0) + 1);
      }
      const required = uiDefs
        .filter((def) => def.level === 'required' || def.level === 'prodRecommended')
        .map((def) => def.key);
      const missing = required.filter((key) => !prodKeys.has(key));
      if (missing.length === 0) {
        pass('vercel.missing', 'Every required UI key is set for the Vercel production target');
      } else {
        fail('vercel.missing', 'UI keys missing from the Vercel production target', missing);
      }
      const dupes = [...duplicates].filter(([, count]) => count > 1).map(([key]) => key);
      if (dupes.length === 0) {
        pass('vercel.dupes', 'No duplicate Vercel entries for the production target');
      } else {
        warn('vercel.dupes', 'Duplicate Vercel entries resolve unpredictably', dupes);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const order = { FAIL: 0, WARN: 1, PASS: 2 };
results.sort((a, b) => order[a.level] - order[b.level]);

if (JSON_OUT) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
} else {
  for (const row of results) {
    console.log(`${row.level.padEnd(4)} ${row.message}`);
    for (const item of row.items) console.log(`     - ${item}`);
  }
  const failures = results.filter((row) => row.level === 'FAIL').length;
  const warnings = results.filter((row) => row.level === 'WARN').length;
  console.log(`\n${results.length} checks · ${failures} fail · ${warnings} warn`);
}
process.exit(results.some((row) => row.level === 'FAIL') ? 1 : 0);
