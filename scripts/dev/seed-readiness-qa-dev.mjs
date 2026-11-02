#!/usr/bin/env node
/**
 * Production-readiness QA seed for hosted dev (launch audit Phase 4.2).
 *
 * Creates QA accounts and orgs through the real edge functions (no direct table
 * writes), then activates one listing so public browse, booking and IDOR checks
 * have data. Idempotent: reuses accounts and orgs that already exist.
 *
 *   node scripts/dev/seed-readiness-qa-dev.mjs
 *
 * Reads DEV_SUPABASE_URL + DEV_SERVICE_ROLE_KEY from supabase/.env.dev.local and
 * VITE_SUPABASE_ANON_KEY from ui/.env.development.dev. Writes the QA logins to
 * supabase/.env.qa.dev.local (gitignored). Refuses any project but hosted dev.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEV_REF = 'fworvijbrwpyngycotbz';
const LEGACY_PROD_REF = 'zfttdwtceyqszyeyhilc';
const CREDENTIALS_FILE = resolve(ROOT, 'supabase/.env.qa.dev.local');

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
const saved = readEnv(CREDENTIALS_FILE);

const URL_BASE = (devEnv.DEV_SUPABASE_URL ?? '').replace(/\/$/, '').replace(/\/functions\/v1$/, '');
const SRK = devEnv.DEV_SERVICE_ROLE_KEY ?? '';
const ANON = uiEnv.VITE_SUPABASE_ANON_KEY ?? '';

if (!URL_BASE.includes(DEV_REF) || URL_BASE.includes(LEGACY_PROD_REF)) {
  console.error(`Refusing: ${URL_BASE || '(empty url)'} is not hosted dev ${DEV_REF}.`);
  process.exit(1);
}
// fwor is production since 2026-10-27. Seeding here creates test tenants in prod
// (cleaned by scripts/migrate/legacy-to-mt-prod/sql/70-clean-prod-test-data.sql).
if (process.env.QA_SEED_CONFIRM !== 'yes') {
  console.error(
    'Refusing: fwor is production. Re-run with QA_SEED_CONFIRM=yes only if you ' +
      'intend to add test orgs/users to prod, then clean them with 70-clean-prod-test-data.sql.'
  );
  process.exit(1);
}
if (!SRK || !ANON) {
  console.error('Missing DEV_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const FN = `${URL_BASE}/functions/v1`;

const ACCOUNTS = [
  { key: 'OWNER', email: 'sprmke.dev+qa-owner@gmail.com' },
  { key: 'OUTSIDER', email: 'sprmke.dev+qa-outsider@gmail.com' },
  { key: 'GUEST', email: 'sprmke.dev+qa-guest@gmail.com' },
];

const ORGS = [
  {
    owner: 'OWNER',
    name: 'Readiness QA Stays',
    propertyName: 'QA Monaco 1801',
    tower: 'Monaco',
    unitNumber: '1801',
    activate: true,
  },
  {
    owner: 'OUTSIDER',
    name: 'Readiness QA Outsider',
    propertyName: 'QA Outsider Loft',
    tower: 'Bali',
    unitNumber: '0702',
    activate: false,
  },
];

async function http(method, url, { token, body, apikey = ANON } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${token ?? apikey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { json } = await http('GET', `${URL_BASE}/auth/v1/admin/users?page=${page}&per_page=200`, {
      apikey: SRK,
    });
    const users = json?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function ensureAccount({ key, email }) {
  const passwordKey = `QA_${key}_PASSWORD`;
  const password = saved[passwordKey] || `Qa-${randomBytes(9).toString('base64url')}-9a`;
  const existing = await findUserByEmail(email);
  if (existing) {
    const upd = await http('PUT', `${URL_BASE}/auth/v1/admin/users/${existing.id}`, {
      apikey: SRK,
      body: { password, email_confirm: true },
    });
    if (upd.status >= 300) throw new Error(`update ${email}: ${upd.status} ${JSON.stringify(upd.json)}`);
  } else {
    const created = await http('POST', `${URL_BASE}/auth/v1/admin/users`, {
      apikey: SRK,
      body: { email, password, email_confirm: true },
    });
    if (created.status >= 300) {
      throw new Error(`create ${email}: ${created.status} ${JSON.stringify(created.json)}`);
    }
  }
  saved[`QA_${key}_EMAIL`] = email;
  saved[passwordKey] = password;
  return adminSession(email);
}

/** Auth captcha is on for hosted dev, so password sign-in needs a Turnstile token. */
async function adminSession(email) {
  const link = await http('POST', `${URL_BASE}/auth/v1/admin/generate_link`, {
    apikey: SRK,
    body: { type: 'magiclink', email },
  });
  const tokenHash = link.json?.hashed_token ?? link.json?.properties?.hashed_token;
  if (!tokenHash) throw new Error(`generate_link ${email}: ${link.status} ${JSON.stringify(link.json)}`);
  const session = await http('POST', `${URL_BASE}/auth/v1/verify`, {
    body: { type: 'magiclink', token_hash: tokenHash },
  });
  if (!session.json?.access_token) {
    throw new Error(`verify ${email}: ${session.status} ${JSON.stringify(session.json)}`);
  }
  return session.json.access_token;
}

async function ensureOrg(spec, token) {
  const list = await http('GET', `${FN}/list-organizations`, { token });
  const orgs = list.json?.data?.organizations ?? list.json?.organizations ?? list.json?.data ?? [];
  let org = Array.isArray(orgs) ? orgs.find((o) => o.name === spec.name) : null;

  if (!org) {
    const created = await http('POST', `${FN}/create-organization`, {
      token,
      body: {
        name: spec.name,
        contactName: 'Quinn Alvarez',
        contactRole: 'property_owner',
        contactPhone: '09171234567',
        hostModes: ['property'],
        propertyName: spec.propertyName,
        residenceName: 'Azure North Residences',
        tower: spec.tower,
        unitNumber: spec.unitNumber,
      },
    });
    if (created.status >= 300) {
      throw new Error(`create-organization ${spec.name}: ${created.status} ${JSON.stringify(created.json)}`);
    }
    org = created.json?.data?.organization ?? created.json?.organization ?? created.json?.data;
  }
  return org;
}

async function findProperty(orgId, name) {
  const { json } = await http(
    'GET',
    `${URL_BASE}/rest/v1/properties?select=id,slug,status,name&organization_id=eq.${orgId}&name=eq.${encodeURIComponent(name)}`,
    { apikey: SRK }
  );
  return Array.isArray(json) ? json[0] : null;
}

/**
 * Puts the QA owner org on a paid plan without PayMongo, mirroring
 * `_shared/planEntitlements.ts#createOrgSubscription` (subscription row, `assigned` event,
 * property slot, `property_added` event). Billing is not exercised; only for RBAC / gate QA.
 */
async function ensureQaPlan(orgId, propertyId, planCode) {
  const rest = (path, init = {}) =>
    http(init.method ?? 'GET', `${URL_BASE}/rest/v1/${path}`, { apikey: SRK, body: init.body });
  const plan = (await rest(`pricing_plans?select=id,code,price_php&code=eq.${planCode}`)).json?.[0];
  if (!plan) throw new Error(`plan ${planCode} not found`);

  const live = (
    await rest(
      `org_subscriptions?select=id,plan_id&organization_id=eq.${orgId}&status=in.(active,trialing,past_due)`
    )
  ).json?.[0];
  if (live) {
    if (live.plan_id !== plan.id) {
      throw new Error(`QA org already on another live plan (${live.plan_id}); change it in /admin`);
    }
    return `plan ${planCode} already active`;
  }

  const inserted = await http('POST', `${URL_BASE}/rest/v1/org_subscriptions`, {
    apikey: SRK,
    body: {
      organization_id: orgId,
      plan_id: plan.id,
      pricing_model: 'subscription',
      price_php_snapshot: plan.price_php,
      status: 'active',
    },
  });
  if (inserted.status >= 300) {
    throw new Error(`subscription insert: ${inserted.status} ${JSON.stringify(inserted.json)}`);
  }
  const subscriptionId = (
    await rest(`org_subscriptions?select=id&organization_id=eq.${orgId}&status=eq.active`)
  ).json?.[0]?.id;
  if (!subscriptionId) throw new Error('subscription not found after insert');

  const writes = [
    ['org_subscription_events', { org_subscription_id: subscriptionId, event_type: 'assigned', new_plan_id: plan.id, new_status: 'active', note: 'readiness QA seed (dev, no billing)' }],
    ['org_subscription_properties', { org_subscription_id: subscriptionId, property_id: propertyId }],
    ['org_subscription_events', { org_subscription_id: subscriptionId, event_type: 'property_added', property_id: propertyId }],
  ];
  for (const [table, body] of writes) {
    const res = await http('POST', `${URL_BASE}/rest/v1/${table}`, { apikey: SRK, body });
    if (res.status >= 300) throw new Error(`${table}: ${res.status} ${JSON.stringify(res.json)}`);
  }
  return `plan ${planCode} assigned (subscription ${subscriptionId})`;
}

const summary = [];
for (const account of ACCOUNTS) {
  account.token = await ensureAccount(account);
  summary.push(`account ${account.key.toLowerCase()} ${account.email}`);
}

for (const spec of ORGS) {
  const owner = ACCOUNTS.find((a) => a.key === spec.owner);
  const org = await ensureOrg(spec, owner.token);
  if (!org?.id) throw new Error(`no org id for ${spec.name}: ${JSON.stringify(org)}`);
  const property = await findProperty(org.id, spec.propertyName);
  if (!property) throw new Error(`property ${spec.propertyName} not found in ${spec.name}`);

  if (spec.activate && property.status !== 'ACTIVE') {
    const res = await http('PATCH', `${FN}/update-property`, {
      token: owner.token,
      body: { propertyId: property.id, status: 'ACTIVE', maxGuests: 4 },
    });
    if (res.status >= 300) {
      throw new Error(`activate ${spec.propertyName}: ${res.status} ${JSON.stringify(res.json)}`);
    }
  }
  const after = await findProperty(org.id, spec.propertyName);
  saved[`QA_${spec.owner}_ORG_SLUG`] = org.slug;
  saved[`QA_${spec.owner}_ORG_ID`] = org.id;
  saved[`QA_${spec.owner}_PROPERTY_SLUG`] = after.slug;
  saved[`QA_${spec.owner}_PROPERTY_ID`] = after.id;
  summary.push(`org ${org.slug} property ${after.slug} ${after.status}`);
}

const planArg = process.argv.includes('--plan')
  ? process.argv[process.argv.indexOf('--plan') + 1]
  : null;
if (planArg) {
  summary.push(await ensureQaPlan(saved.QA_OWNER_ORG_ID, saved.QA_OWNER_PROPERTY_ID, planArg));
}

writeFileSync(
  CREDENTIALS_FILE,
  `# Hosted-dev readiness QA logins. Gitignored. Regenerate: node scripts/dev/seed-readiness-qa-dev.mjs\n${Object.entries(
    saved
  )
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')}\n`
);

const browse = await http('GET', `${FN}/list-public-properties?pageSize=5`);
summary.push(`list-public-properties total=${browse.json?.total}`);
console.log(summary.join('\n'));
console.log(`Credentials: ${CREDENTIALS_FILE}`);
