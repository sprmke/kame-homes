#!/usr/bin/env node
/**
 * Property team role matrix on hosted dev (launch audit Phase 6 A01/API5, Phase 7 team card).
 *
 *   node scripts/dev/seed-readiness-qa-dev.mjs --plan growth   # once (Free allows no members)
 *   node scripts/dev/probe-readiness-rbac-dev.mjs
 *
 * Invites one member per seeded template through the real `property-team-invitations` API
 * (sends the invite email to the QA alias), accepts it as that user via `accept-property-invite`,
 * then checks each role's reads and writes against SEEDED_TEMPLATE_PERMISSIONS
 * (`_shared/propertyTeamTemplates.ts`). Exit 1 on any mismatch.
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
  console.error('Hosted dev only; run seed-readiness-qa-dev.mjs --plan growth first.');
  process.exit(1);
}
const FN = `${URL_BASE}/functions/v1`;
const PID = qa.QA_OWNER_PROPERTY_ID;

const ROLES = [
  { name: 'Full Access', email: 'sprmke.dev+qa-full@gmail.com' },
  { name: 'Operations', email: 'sprmke.dev+qa-ops@gmail.com' },
  { name: 'Read Only', email: 'sprmke.dev+qa-readonly@gmail.com' },
];

async function http(method, url, { token = ANON, apikey = ANON, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { apikey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function ensureUser(email) {
  const list = await http('GET', `${URL_BASE}/auth/v1/admin/users?per_page=200`, {
    token: SRK,
    apikey: SRK,
  });
  if ((list.json?.users ?? []).some((u) => u.email === email)) return;
  const created = await http('POST', `${URL_BASE}/auth/v1/admin/users`, {
    token: SRK,
    apikey: SRK,
    body: { email, email_confirm: true },
  });
  if (created.status >= 300) throw new Error(`create ${email}: ${JSON.stringify(created.json)}`);
}

async function session(email) {
  const link = await http('POST', `${URL_BASE}/auth/v1/admin/generate_link`, {
    token: SRK,
    apikey: SRK,
    body: { type: 'magiclink', email },
  });
  const tokenHash = link.json?.hashed_token ?? link.json?.properties?.hashed_token;
  const s = await http('POST', `${URL_BASE}/auth/v1/verify`, {
    body: { type: 'magiclink', token_hash: tokenHash },
  });
  if (!s.json?.access_token) throw new Error(`session ${email}: ${JSON.stringify(s.json)}`);
  return s.json.access_token;
}

async function rest(path) {
  return (await http('GET', `${URL_BASE}/rest/v1/${path}`, { token: SRK, apikey: SRK })).json ?? [];
}

const owner = await session(qa.QA_OWNER_EMAIL);
const roles = await rest(`property_custom_roles?select=id,name&property_id=eq.${PID}`);

for (const role of ROLES) {
  role.id = roles.find((r) => r.name === role.name)?.id;
  if (!role.id) throw new Error(`role ${role.name} not seeded on QA property`);
  await ensureUser(role.email);

  const member = await rest(
    `property_members?select=id,role_id&property_id=eq.${PID}&email=eq.${encodeURIComponent(role.email)}`
  );
  if (!member.length) {
    const pending = await rest(
      `property_invitations?select=token&property_id=eq.${PID}&email=eq.${encodeURIComponent(role.email)}&status=eq.pending`
    );
    if (!pending.length) {
      const invite = await http('POST', `${FN}/property-team-invitations`, {
        token: owner,
        body: { propertyId: PID, email: role.email, roleId: role.id, contactPhone: '09171234567' },
      });
      if (invite.status >= 300) {
        throw new Error(`invite ${role.name}: ${invite.status} ${JSON.stringify(invite.json)}`);
      }
    }
    const [inv] = await rest(
      `property_invitations?select=token&property_id=eq.${PID}&email=eq.${encodeURIComponent(role.email)}&status=eq.pending`
    );
    const accepted = await http('POST', `${FN}/accept-property-invite`, {
      token: await session(role.email),
      body: { token: inv.token },
    });
    if (accepted.status >= 300) {
      throw new Error(`accept ${role.name}: ${accepted.status} ${JSON.stringify(accepted.json)}`);
    }
  }
  role.token = await session(role.email);
}

const ok = (s) => s >= 200 && s < 300;
const denied = (s) => s === 401 || s === 403;
const CASES = [
  { label: 'GET list-bookings', method: 'GET', path: `list-bookings?property_id=${PID}`, allow: ['Full Access', 'Operations', 'Read Only'] },
  { label: 'GET maintenance-summary', method: 'GET', path: `maintenance-summary?property_id=${PID}`, allow: ['Full Access', 'Operations', 'Read Only'] },
  { label: 'GET finance-summary', method: 'GET', path: `finance-summary?property_id=${PID}`, allow: ['Full Access'] },
  { label: 'GET app-settings', method: 'GET', path: `app-settings?property_id=${PID}`, allow: ['Full Access'] },
  { label: 'GET property-team-members', method: 'GET', path: `property-team-members?property_id=${PID}`, allow: ['Full Access', 'Read Only'] },
  { label: 'PATCH update-property (no-op maxGuests)', method: 'PATCH', path: 'update-property', body: { propertyId: PID, maxGuests: 4 }, allow: ['Full Access'] },
  { label: 'POST property-team-invitations', method: 'POST', path: 'property-team-invitations', body: { propertyId: PID, email: 'not-an-email', roleId: 'x' }, allow: [], skipFor: ['Full Access'] },
];

const rows = [];
let mismatches = 0;
for (const c of CASES) {
  const cells = [];
  for (const role of ROLES) {
    if (c.skipFor?.includes(role.name)) {
      cells.push('skip');
      continue;
    }
    const res = await http(c.method, `${FN}/${c.path}`, { token: role.token, body: c.body });
    const expectAllow = c.allow.includes(role.name);
    const pass = expectAllow ? ok(res.status) : denied(res.status);
    if (!pass) mismatches += 1;
    cells.push(`${res.status}${pass ? '' : ' ✗'}`);
  }
  rows.push(`| ${c.label} | ${cells.join(' | ')} |`);
}

console.log(`| Call | ${ROLES.map((r) => r.name).join(' | ')} |`);
console.log(`| ---- | ${ROLES.map(() => '---').join(' | ')} |`);
console.log(rows.join('\n'));
console.log(mismatches ? `\n${mismatches} MISMATCH(ES) vs seeded templates` : '\nAll roles match seeded templates.');
process.exit(mismatches ? 1 : 0);
