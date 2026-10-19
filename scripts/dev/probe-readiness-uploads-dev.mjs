#!/usr/bin/env node
/**
 * Hosted-dev probe: uploads must reject bytes that do not match an allowed type (PR-016).
 *
 * Sends a spoofed HTML file and a PDF labelled image/png, plus one real PNG, as the
 * seeded QA owner. The accepted PNG is deleted afterwards. Refuses any project but hosted dev.
 *
 * Reads DEV_SUPABASE_URL + DEV_SERVICE_ROLE_KEY (supabase/.env.dev.local),
 * VITE_SUPABASE_ANON_KEY (ui/.env.development.dev) and QA logins (supabase/.env.qa.dev.local).
 *
 *   node scripts/dev/probe-readiness-uploads-dev.mjs
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

if (!URL_BASE.includes(DEV_REF) || !qa.QA_OWNER_EMAIL || !qa.QA_OWNER_ORG_ID) {
  console.error('Refusing: hosted dev env or QA fixtures missing.');
  process.exit(1);
}

async function json(method, path, { token = ANON, apikey = ANON, body } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { apikey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function session(email) {
  const link = await json('POST', '/auth/v1/admin/generate_link', {
    token: SRK,
    apikey: SRK,
    body: { type: 'magiclink', email },
  });
  const tokenHash = link.json?.hashed_token ?? link.json?.properties?.hashed_token;
  const s = await json('POST', '/auth/v1/verify', {
    body: { type: 'magiclink', token_hash: tokenHash },
  });
  if (!s.json?.access_token) throw new Error(`session failed for ${email}`);
  return s.json.access_token;
}

const PNG_1PX = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
);
const HTML = new TextEncoder().encode('<!doctype html><script>alert(document.domain)</script>');
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

async function upload(fn, token, fields, bytes, mime, name, query = '') {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set('file', new Blob([bytes], { type: mime }), name);
  const res = await fetch(`${URL_BASE}/functions/v1/${fn}${query}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const owner = await session(qa.QA_OWNER_EMAIL);
const results = [];
function record(name, expectOk, r) {
  const ok = expectOk ? r.status < 300 : r.status >= 400;
  const message = r.body?.error ?? r.body?.message ?? '';
  results.push({ name, status: r.status, pass: ok, message: String(message).slice(0, 90) });
  return r;
}

const ticket = { orgId: qa.QA_OWNER_ORG_ID };
record(
  'support ticket: HTML labelled image/png',
  false,
  await upload('upload-support-ticket-attachment', owner, ticket, HTML, 'image/png', 'x.png')
);
record(
  'support ticket: PDF labelled image/png',
  false,
  await upload('upload-support-ticket-attachment', owner, ticket, PDF, 'image/png', 'x.png')
);
const good = record(
  'support ticket: real PNG',
  true,
  await upload('upload-support-ticket-attachment', owner, ticket, PNG_1PX, 'image/png', 'ok.png')
);

const gcashQuery = `?property_id=${qa.QA_OWNER_PROPERTY_ID}`;
record(
  'app settings gcash_qr: HTML labelled image/png',
  false,
  await upload(
    'upload-app-settings-asset',
    owner,
    { assetType: 'gcash_qr', fileName: 'qr.png' },
    HTML,
    'image/png',
    'qr.png',
    gcashQuery
  )
);

const path = good.body?.data?.attachment?.path ?? good.body?.attachment?.path;
if (path) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/support-ticket-attachments/${path}`, {
    method: 'DELETE',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  results.push({ name: 'cleanup accepted PNG', status: res.status, pass: res.ok, message: '' });
}

console.table(results);
process.exit(results.every((r) => r.pass) ? 0 : 1);
