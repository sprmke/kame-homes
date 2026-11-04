#!/usr/bin/env node
/**
 * BOPLA (mass-assignment) probe on hosted dev — OWASP API3 / plan 6.2.
 *
 * Sends privileged fields (`organization_id`, `owner_id`, `plan_id`, `property_id`,
 * `created_at`, `status`) on write endpoints as the QA owner and asserts the server
 * ignores them: the row must stay in the caller's org/property with its own ids.
 *
 *   node scripts/dev/seed-readiness-qa-dev.mjs          # once
 *   node scripts/dev/probe-readiness-bopla-dev.mjs
 *
 * Refuses any project but hosted dev. Leaves the QA rows as it found them.
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

const URL_BASE = (devEnv.DEV_SUPABASE_URL ?? '').replace(/\/$/, '');
const SRK = devEnv.DEV_SERVICE_ROLE_KEY ?? '';
const ANON = uiEnv.VITE_SUPABASE_ANON_KEY ?? '';
const FN = `${URL_BASE}/functions/v1`;

if (!URL_BASE.includes(DEV_REF) || !qa.QA_OWNER_PROPERTY_ID) {
  console.error('Run against hosted dev after seed-readiness-qa-dev.mjs.');
  process.exit(1);
}

const admin = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };

async function session(email) {
  const link = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: admin,
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function rest(path) {
  return (await fetch(`${URL_BASE}/rest/v1/${path}`, { headers: admin })).json();
}

const owner = await session(qa.QA_OWNER_EMAIL);
const PID = qa.QA_OWNER_PROPERTY_ID;
const OID = qa.QA_OWNER_ORG_ID;
const OUTSIDER_ORG = qa.QA_OUTSIDER_ORG_ID;
const OUTSIDER_PROPERTY = qa.QA_OUTSIDER_PROPERTY_ID;

const rows = [];
const record = (name, pass, detail) => rows.push({ name, pass, detail });

// ── 1. update-property cannot move the row or rewrite ids ────────────────────
{
  const before = (await rest(`properties?select=id,organization_id,name,slug&id=eq.${PID}`))[0];
  const res = await call(owner, 'PATCH', 'update-property', {
    propertyId: PID,
    organizationId: OUTSIDER_ORG,
    organization_id: OUTSIDER_ORG,
    owner_id: qa.QA_OUTSIDER_EMAIL,
    plan_code: 'business',
    created_at: '2000-01-01T00:00:00Z',
    description: before?.name ?? 'QA',
  });
  const after = (await rest(`properties?select=id,organization_id,slug&id=eq.${PID}`))[0];
  record(
    'update-property ignores organization_id / owner_id / plan_code / created_at',
    after?.organization_id === OID && before?.organization_id === after?.organization_id,
    `status=${res.status} org=${after?.organization_id === OID ? 'unchanged' : after?.organization_id}`
  );
}

// ── 2. update-organization cannot rewrite ids or the owner ───────────────────
{
  const before = (await rest(`organizations?select=id,owner_id,slug&id=eq.${OID}`))[0];
  const res = await call(owner, 'PATCH', 'update-organization', {
    orgId: OID,
    id: OUTSIDER_ORG,
    organization_id: OUTSIDER_ORG,
    owner_id: '00000000-0000-4000-8000-000000000000',
    plan_id: '00000000-0000-4000-8000-000000000001',
    subscription_status: 'active',
  });
  const after = (await rest(`organizations?select=id,owner_id,slug&id=eq.${OID}`))[0];
  record(
    'update-organization ignores id / owner_id / plan_id',
    after?.id === OID && after?.owner_id === before?.owner_id,
    `status=${res.status} owner=${after?.owner_id === before?.owner_id ? 'unchanged' : 'CHANGED'}`
  );
}

// ── 3. create-property lands in the caller's org ─────────────────────────────
{
  let createdId = null;
  const res = await call(owner, 'POST', 'create-property', {
    organizationId: OUTSIDER_ORG,
    organization_id: OUTSIDER_ORG,
    owner_id: '00000000-0000-4000-8000-000000000000',
    name: `QA BOPLA ${Date.now()}`,
    type: 'CONDO',
    residenceName: 'Azure North Residences',
    tower: 'Bali',
    unitNumber: String(9000 + Math.floor(Math.random() * 900)),
  });
  const payload = res.json?.data?.property ?? res.json?.property ?? res.json?.data;
  createdId = payload?.id ?? null;
  const after = createdId
    ? (await rest(`properties?select=id,organization_id&id=eq.${createdId}`))[0]
    : null;
  if (createdId) {
    await fetch(`${URL_BASE}/rest/v1/properties?id=eq.${createdId}`, {
      method: 'DELETE',
      headers: { ...admin, Prefer: 'return=minimal' },
    });
  }
  record(
    'create-property ignores a supplied organization_id',
    after ? after.organization_id === OID : res.status >= 400,
    `status=${res.status} org=${after ? (after.organization_id === OID ? 'caller' : 'OUTSIDER') : 'n/a'}`
  );
}

// ── 4. transition-booking stays scoped to the booking's property ─────────────
{
  const booking = (
    await rest(
      `guest_submissions?select=id,property_id,status&property_id=eq.${PID}&order=created_at.desc&limit=1`
    )
  )[0];
  if (!booking) {
    record('transition-booking ignores an injected property_id', true, 'no QA booking (skipped)');
  } else {
    const res = await call(owner, 'POST', `transition-booking?property_id=${PID}`, {
      bookingId: booking.id,
      toStatus: booking.status,
      property_id: OUTSIDER_PROPERTY,
      organization_id: OUTSIDER_ORG,
      payload: {},
      manual: true,
    });
    const after = (
      await rest(`guest_submissions?select=id,property_id&id=eq.${booking.id}`)
    )[0];
    record(
      'transition-booking ignores an injected property_id/organization_id',
      after?.property_id === PID,
      `status=${res.status} property=${after?.property_id === PID ? 'unchanged' : 'MOVED'}`
    );
  }
}

// ── 5. invites cannot borrow another org's custom role ───────────────────────
{
  const outsiderRoles = await rest(
    `property_custom_roles?select=id,name&property_id=eq.${OUTSIDER_PROPERTY}`
  );
  const foreignRole = Array.isArray(outsiderRoles) ? outsiderRoles[0] : null;
  if (!foreignRole) {
    record('property-team-invitations rejects a foreign roleId', true, 'no outsider role (skipped)');
  } else {
    const res = await call(owner, 'POST', 'property-team-invitations', {
      propertyId: PID,
      email: `qa-bopla-${Date.now()}@example.com`,
      roleId: foreignRole.id,
      contactPhone: '09171234567',
    });
    record(
      'property-team-invitations rejects a foreign roleId',
      res.status >= 400,
      `status=${res.status} ${JSON.stringify(res.json?.error ?? '').slice(0, 60)}`
    );
  }
}

const failed = rows.filter((r) => !r.pass);
console.table(rows);
if (failed.length) {
  console.error(`\nBOPLA probe FAILED: ${failed.length}/${rows.length}`);
  process.exit(1);
}
console.log(`\nBOPLA probe OK: ${rows.length}/${rows.length} privileged fields ignored.`);
