#!/usr/bin/env node
/**
 * Hosted-dev probe for property team invite acceptance abuse (PR-014, issue #162).
 *
 * Inserts invitations directly (service role, so no invite email is sent) on the QA owner's
 * property and checks accept-property-invite: wrong signed-in email (403), random token (404),
 * invitee accepts (200), token reuse (410), expired invite (410). Cleans up the membership and
 * invitations afterwards. Refuses any project but hosted dev.
 *
 *   node scripts/dev/probe-readiness-invites-dev.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEV_REF = 'fworvijbrwpyngycotbz';
const INVITEE = 'sprmke.dev+qa-invitee@gmail.com';

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
const PID = qa.QA_OWNER_PROPERTY_ID;

if (!URL_BASE.includes(DEV_REF) || !PID || !qa.QA_OUTSIDER_EMAIL) {
  console.error('Refusing: hosted dev env or QA fixtures missing.');
  process.exit(1);
}

const admin = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };

async function http(method, path, { headers = admin, body } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 160) };
  }
  return { status: res.status, json };
}

async function userId(email) {
  const list = await http('GET', '/auth/v1/admin/users?per_page=200');
  const found = (list.json?.users ?? []).find((u) => u.email === email);
  if (found) return found.id;
  const created = await http('POST', '/auth/v1/admin/users', {
    body: { email, email_confirm: true },
  });
  if (!created.json?.id) throw new Error(`create ${email} failed`);
  return created.json.id;
}

async function session(email) {
  const link = await http('POST', '/auth/v1/admin/generate_link', {
    body: { type: 'magiclink', email },
  });
  const tokenHash = link.json?.hashed_token ?? link.json?.properties?.hashed_token;
  const s = await http('POST', '/auth/v1/verify', {
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: { type: 'magiclink', token_hash: tokenHash },
  });
  if (!s.json?.access_token) throw new Error(`session failed for ${email}`);
  return s.json.access_token;
}

async function accept(token, accessToken) {
  return http('POST', '/functions/v1/accept-property-invite', {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: { token },
  });
}

const ownerId = await userId(qa.QA_OWNER_EMAIL);
const inviteeId = await userId(INVITEE);
const roles = await http(
  'GET',
  `/rest/v1/property_custom_roles?select=id,name&property_id=eq.${PID}`
);
const role = (roles.json ?? []).find((r) => r.name === 'Read Only') ?? (roles.json ?? [])[0];
if (!role) throw new Error('No custom role on the QA property');

const day = 86_400_000;
const tokens = { live: randomBytes(32).toString('hex'), expired: randomBytes(32).toString('hex') };
async function insertInvite(token, expiresInMs) {
  const r = await http('POST', '/rest/v1/property_invitations', {
    headers: { ...admin, Prefer: 'return=representation' },
    body: {
      property_id: PID,
      email: INVITEE,
      role_id: role.id,
      token,
      expires_at: new Date(Date.now() + expiresInMs).toISOString(),
      sent_by: ownerId,
    },
  });
  if (r.status >= 300) throw new Error(`insert invitation: ${JSON.stringify(r.json)}`);
  return r.json[0].id;
}
const invitationIds = [await insertInvite(tokens.live, day)];

const outsider = await session(qa.QA_OUTSIDER_EMAIL);
const invitee = await session(INVITEE);
const results = [];
const record = (name, expect, r) =>
  results.push({
    case: name,
    expect,
    status: r.status,
    pass: r.status === expect,
    error: String(r.json?.error ?? '').slice(0, 60),
  });

try {
  record('wrong signed-in email', 403, await accept(tokens.live, outsider));
  record('random token', 404, await accept(randomBytes(32).toString('hex'), invitee));
  record('invitee accepts', 200, await accept(tokens.live, invitee));
  record('token reuse', 410, await accept(tokens.live, invitee));
  // One pending invite per property + email (unique index), so the expired one comes after.
  await http('DELETE', `/rest/v1/property_members?property_id=eq.${PID}&user_id=eq.${inviteeId}`);
  invitationIds.push(await insertInvite(tokens.expired, -day));
  record('expired invite', 410, await accept(tokens.expired, invitee));
  const leak = results.find((r) => r.case === 'wrong signed-in email');
  results.push({
    case: 'mismatch message hides invitee email',
    expect: 'no email',
    status: 0,
    pass: !leak.error.includes(INVITEE),
    error: '',
  });
} finally {
  await http('DELETE', `/rest/v1/property_members?property_id=eq.${PID}&user_id=eq.${inviteeId}`);
  await http('DELETE', `/rest/v1/property_invitations?id=in.(${invitationIds.join(',')})`);
}

console.table(results);
process.exit(results.every((r) => r.pass) ? 0 : 1);
