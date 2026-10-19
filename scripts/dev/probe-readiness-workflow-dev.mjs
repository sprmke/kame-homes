#!/usr/bin/env node
/**
 * Booking workflow walk on hosted dev (launch audit Phase 7, bookings card).
 *
 *   node scripts/dev/probe-readiness-workflow-dev.mjs <bookingId>
 *
 * Drives a QA booking from PENDING_DOCUMENTS to COMPLETED as the QA owner through the same
 * edge calls the booking detail page uses (`upload-booking-asset`, `transition-booking`), and
 * prints status + side effects after each step. Also checks two guard rails: a forward skip
 * the graph forbids, and Ready-for-checkout without a matching balance settlement.
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
const bookingId = process.argv[2];
if (!URL_BASE.includes(DEV_REF) || !qa.QA_OWNER_PROPERTY_ID || !bookingId) {
  console.error('Usage: node scripts/dev/probe-readiness-workflow-dev.mjs <QA bookingId> (hosted dev only)');
  process.exit(1);
}
const FN = `${URL_BASE}/functions/v1`;
const PID = qa.QA_OWNER_PROPERTY_ID;

const PDF = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
);

async function session(email) {
  const link = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const s = await fetch(`${URL_BASE}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }),
  }).then((r) => r.json());
  if (!s.access_token) throw new Error(`session ${email} failed`);
  return s.access_token;
}

const token = await session(qa.QA_OWNER_EMAIL);
const auth = { apikey: ANON, Authorization: `Bearer ${token}` };

async function booking() {
  const rows = await fetch(
    `${URL_BASE}/rest/v1/guest_submissions?select=status,booking_rate,down_payment,security_deposit,pet_fee,guest_additional_fee,approved_gaf_pdf_url,gaf_completed_at,guest_balance_paid_amount&id=eq.${bookingId}`,
    { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }
  ).then((r) => r.json());
  return rows[0];
}

async function upload(assetType, bytes, mime, name) {
  const fd = new FormData();
  fd.append('bookingId', bookingId);
  fd.append('assetType', assetType);
  fd.append('file', new Blob([bytes], { type: mime }), name);
  const res = await fetch(`${FN}/upload-booking-asset?property_id=${PID}`, { method: 'POST', headers: auth, body: fd });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, url: json?.data?.url, error: json?.error };
}

async function transition(toStatus, payload = {}) {
  const res = await fetch(`${FN}/transition-booking?property_id=${PID}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, toStatus, payload, manual: true }),
  });
  const json = await res.json().catch(() => ({}));
  const side = json?.data?.sideEffects ?? json?.sideEffects ?? {};
  return {
    status: res.status,
    newStatus: json?.data?.booking?.status ?? json?.booking?.status,
    error: json?.error,
    skippedByPlan: side.automationSkippedByPlan,
  };
}

const log = (step, r) => console.log(`${step.padEnd(52)} ${JSON.stringify(r)}`);

const start = await booking();
log('start', { status: start.status });

log('guard: PENDING_DOCUMENTS → COMPLETED (not in graph)', await transition('COMPLETED'));

const gaf = await upload('approved_gaf', PDF, 'application/pdf', 'approved-gaf.pdf');
log('upload approved_gaf (PDF)', { status: gaf.status, stored: Boolean(gaf.url), error: gaf.error });
const fakePdf = await upload('approved_gaf', new TextEncoder().encode('<html>x</html>'), 'application/pdf', 'x.pdf');
log('guard: HTML declared as PDF', { status: fakePdf.status, error: fakePdf.error });

log('mark GAF complete', await transition('PENDING_DOCUMENTS', { document_completion_target: 'gaf' }));
const afterGaf = await booking();
if (afterGaf.status === 'PENDING_DOCUMENTS') {
  log('→ READY_FOR_CHECKIN', await transition('READY_FOR_CHECKIN'));
}

const b = await booking();
const total =
  Number(b.booking_rate ?? 0) -
  Number(b.down_payment ?? 0) +
  Number(b.security_deposit ?? 0) +
  Number(b.pet_fee ?? 0) +
  Number(b.guest_additional_fee ?? 0);
log('guard: RFCO with wrong paid amount', await transition('READY_FOR_CHECKOUT', { guest_balance_paid_amount: 1 }));
const receipt = await upload('guest_balance_payment_receipt', PDF, 'application/pdf', 'balance.pdf');
log('upload guest balance receipt', { status: receipt.status, stored: Boolean(receipt.url) });
log(
  `→ READY_FOR_CHECKOUT (paid ₱${total})`,
  await transition('READY_FOR_CHECKOUT', {
    guest_balance_paid_amount: total,
    guest_balance_payment_receipt_url: receipt.url,
  })
);
log('→ PENDING_SD_REFUND (host skip)', await transition('PENDING_SD_REFUND'));
log('→ COMPLETED', await transition('COMPLETED'));
log('guard: COMPLETED → PENDING_REVIEW (terminal)', await transition('PENDING_REVIEW'));

const end = await booking();
const activity = await fetch(
  `${URL_BASE}/rest/v1/activity_log?select=action,metadata&target_id=eq.${bookingId}&order=created_at.asc`,
  { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }
).then((r) => r.json());
console.log(`\nfinal status: ${end.status}`);
console.log(
  'activity:',
  activity.map((a) => `${a.action}${a.metadata?.to_status ? `→${a.metadata.to_status}` : ''}`).join(', ')
);
