#!/usr/bin/env node
/**
 * Hosted-dev probe for guest-link access tokens after the legacy grace window (PR-008).
 *
 * Temporarily backdates one QA booking's `created_at` past GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS,
 * calls the public guest reads with no token and with a forged token (expect 401), restores
 * `created_at`, then confirms the bare link works again inside grace. Write paths sit behind
 * captcha and call the same `authorizeGuestBookingAccess`; see guestBookingAccessToken_test.ts.
 * Refuses any project but hosted dev.
 *
 *   node scripts/dev/probe-readiness-guest-token-dev.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEV_REF = 'fworvijbrwpyngycotbz';

function readEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const devEnv = readEnv(resolve(ROOT, 'supabase/.env.dev.local'));
const uiEnv = readEnv(resolve(ROOT, 'ui/.env.development.dev'));
const qa = readEnv(resolve(ROOT, 'supabase/.env.qa.dev.local'));
const URL_BASE = devEnv.DEV_SUPABASE_URL ?? '';
const SRK = devEnv.DEV_SERVICE_ROLE_KEY ?? '';
const ANON = uiEnv.VITE_SUPABASE_ANON_KEY ?? '';

if (!URL_BASE.includes(DEV_REF) || !qa.QA_OWNER_PROPERTY_ID) {
  console.error('Refusing: hosted dev env or QA fixtures missing.');
  process.exit(1);
}

const admin = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };

async function bookingRow() {
  const res = await fetch(
    `${URL_BASE}/rest/v1/guest_submissions?select=id,created_at&property_id=eq.${qa.QA_OWNER_PROPERTY_ID}&order=created_at.desc&limit=1`,
    { headers: admin }
  );
  const rows = await res.json();
  if (!rows?.[0]) throw new Error('No QA booking found');
  return rows[0];
}

async function setCreatedAt(id, value) {
  const res = await fetch(`${URL_BASE}/rest/v1/guest_submissions?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...admin, Prefer: 'return=minimal' },
    body: JSON.stringify({ created_at: value }),
  });
  if (!res.ok) throw new Error(`created_at update failed: ${res.status}`);
}

async function get(path) {
  const res = await fetch(`${URL_BASE}/functions/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, error: body?.error ?? body?.message ?? '' };
}

const FORGED = 'eyJhbGciOiJIUzI1NiJ9.eyJiIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAwIn0.x';
const row = await bookingRow();
const original = row.created_at;
const reads = (id, access) => {
  const q = access ? `access=${encodeURIComponent(access)}` : '';
  return [
    ['get-form', `get-form/${id}${q ? `?${q}` : ''}`],
    ['get-sd-form', `get-sd-form?bookingId=${id}${q ? `&${q}` : ''}`],
    ['get-guest-review', `get-guest-review?bookingId=${id}${q ? `&${q}` : ''}`],
  ];
};

const results = [];
try {
  await setCreatedAt(row.id, new Date(Date.now() - 40 * 86_400_000).toISOString());
  for (const [name, path] of reads(row.id)) {
    const r = await get(path);
    results.push({ case: `${name}: past grace, no token`, status: r.status, pass: r.status === 401, error: r.error });
  }
  for (const [name, path] of reads(row.id, FORGED)) {
    const r = await get(path);
    results.push({ case: `${name}: past grace, forged token`, status: r.status, pass: r.status === 401, error: r.error });
  }
} finally {
  await setCreatedAt(row.id, original);
}
const [, insideGrace] = reads(row.id)[0];
const r = await get(insideGrace);
results.push({ case: 'get-form: inside grace, no token', status: r.status, pass: r.status !== 401, error: r.error });
const restored = await bookingRow();
results.push({
  case: 'created_at restored',
  status: 0,
  pass: restored.id !== row.id || restored.created_at === original,
  error: '',
});

console.table(results.map((x) => ({ ...x, error: String(x.error).slice(0, 50) })));
process.exit(results.every((x) => x.pass) ? 0 : 1);
