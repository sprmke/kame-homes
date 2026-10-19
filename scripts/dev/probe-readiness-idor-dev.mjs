#!/usr/bin/env node
/**
 * Cross-tenant (IDOR) probes on hosted dev with real QA sessions (launch audit Phase 6, A01/API1).
 *
 *   node scripts/dev/seed-readiness-qa-dev.mjs   # once
 *   node scripts/dev/probe-readiness-idor-dev.mjs
 *
 * The outsider and guest must be refused every read/write on the QA owner's org and property;
 * the owner calls are positive controls. Read-only except the denied writes. Exit 1 on any leak.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEV_REF = 'fworvijbrwpyngycotbz';

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
}

const devEnv = readEnv(resolve(ROOT, 'supabase/.env.dev.local'));
const uiEnv = readEnv(resolve(ROOT, 'ui/.env.development.dev'));
const qa = readEnv(resolve(ROOT, 'supabase/.env.qa.dev.local'));

const URL_BASE = (devEnv.DEV_SUPABASE_URL ?? '').replace(/\/$/, '').replace(/\/functions\/v1$/, '');
const SRK = devEnv.DEV_SERVICE_ROLE_KEY ?? '';
const ANON = uiEnv.VITE_SUPABASE_ANON_KEY ?? '';
if (!URL_BASE.includes(DEV_REF) || !qa.QA_OWNER_PROPERTY_ID) {
  console.error('Run against hosted dev after seed-readiness-qa-dev.mjs.');
  process.exit(1);
}
const FN = `${URL_BASE}/functions/v1`;

async function session(email) {
  const link = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const tokenHash = link.hashed_token ?? link.properties?.hashed_token;
  const res = await fetch(`${URL_BASE}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  }).then((r) => r.json());
  if (!res.access_token) throw new Error(`session ${email} failed`);
  return res.access_token;
}

async function call(token, method, path, body) {
  const res = await fetch(`${FN}/${path}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 160) };
}

const owner = await session(qa.QA_OWNER_EMAIL);
const outsider = await session(qa.QA_OUTSIDER_EMAIL);
const guest = await session(qa.QA_GUEST_EMAIL);

const pid = qa.QA_OWNER_PROPERTY_ID;
const oid = qa.QA_OWNER_ORG_ID;
const oslug = qa.QA_OWNER_ORG_SLUG;

const cases = [
  ['GET', `list-bookings?property_id=${pid}`],
  ['GET', `dashboard-stats?property_id=${pid}`],
  ['GET', `finance-summary?property_id=${pid}`],
  ['GET', `app-settings?property_id=${pid}`],
  ['GET', `property-team-members?property_id=${pid}`],
  ['GET', `list-activity-log?orgId=${oid}`],
  ['GET', `org-settings?org_id=${oid}`],
  ['GET', `org-team-members?org_id=${oid}`],
  ['GET', `org-plan?orgSlug=${oslug}`],
  ['PATCH', 'update-property', { propertyId: pid, status: 'INACTIVE' }],
  ['POST', 'create-property', { orgId: oid, name: 'IDOR Probe Unit' }],
  ['PATCH', 'update-organization', { orgId: oid, name: 'IDOR Probe Rename' }],
  ['DELETE', 'delete-property', { propertyId: pid }],
];

const rows = [];
let leaks = 0;
for (const [method, path, body] of cases) {
  const ownerRes = method === 'GET' ? await call(owner, method, path, body) : { status: '-', body: '' };
  const outsiderRes = await call(outsider, method, path, body);
  const guestRes = await call(guest, method, path, body);
  const denied = (s) => s === 401 || s === 403 || s === 404;
  const probeBroken = method === 'GET' && ownerRes.status >= 400;
  const leak = !probeBroken && (!denied(outsiderRes.status) || !denied(guestRes.status));
  if (leak || probeBroken) leaks += 1;
  const result = probeBroken ? 'PROBE BROKEN' : leak ? 'LEAK' : 'ok';
  rows.push(
    `| ${method} ${path.split('?')[0]} | ${ownerRes.status} | ${outsiderRes.status} | ${guestRes.status} | ${result} |`
  );
  if (leak || probeBroken) {
    rows.push(`|   owner: ${ownerRes.body} outsider: ${outsiderRes.body} | | | | |`);
  }
}

const check = await fetch(
  `${URL_BASE}/rest/v1/properties?select=status,name&id=eq.${pid}`,
  { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }
).then((r) => r.json());

console.log('| Call | Owner | Outsider | Guest | Result |');
console.log('| ---- | ----- | -------- | ----- | ------ |');
console.log(rows.join('\n'));
console.log(`\nOwner property after probes: ${JSON.stringify(check)}`);
console.log(leaks ? `\n${leaks} LEAK(S)` : '\nNo cross-tenant access.');
process.exit(leaks ? 1 : 0);
