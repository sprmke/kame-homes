#!/usr/bin/env bun
/**
 * Phase 1.4 — verify fwor Auth Site URL + redirect allow list (read-only).
 * Needs a valid SUPABASE_ACCESS_TOKEN (env) or refreshed `supabase login` keychain token.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchAuthConfig,
  managementTokenHelp,
  resolveSupabaseAccessToken,
} from './lib/supabaseManagementToken.mjs';

const ROOT = join(import.meta.dir, '..', '..', '..');
const REF = 'fworvijbrwpyngycotbz';
const OUT = join(ROOT, 'backups/legacy-prod-config/20261101/fwor-auth-config-redacted.json');

/** Required before T0 (kamespace.com can be added at cutover). */
const REQUIRED_REDIRECT_SUBSTRINGS = [
  'https://dev.kamehomes.space',
  'https://app.kamehomes.space',
];

/** At T0, Site URL should be kamespace.com; until then dev URL is acceptable. */
const ACCEPTABLE_SITE_URL_PREFIXES = [
  'https://dev.kamehomes.space',
  'https://app.kamehomes.space',
  'https://kamespace.com',
];

function parseAllowList(uriAllowList) {
  if (!uriAllowList || typeof uriAllowList !== 'string') return [];
  return uriAllowList
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowListCovers(allowList, requiredSubstr) {
  return allowList.some(
    (entry) => entry.includes(requiredSubstr) || entry.replace(/\*\*$/, '').includes(requiredSubstr)
  );
}

const token = resolveSupabaseAccessToken();
if (!token) {
  console.error('verify-fwor-auth-redirects: no sbp_ Management API token\n' + managementTokenHelp());
  process.exit(2);
}

const { status, body } = await fetchAuthConfig(REF, token);
if (status === 401) {
  console.error(
    'verify-fwor-auth-redirects: Management API 401 — refresh token (supabase login) or export SUPABASE_ACCESS_TOKEN from Dashboard'
  );
  process.exit(2);
}
if (status !== 200) {
  console.error('verify-fwor-auth-redirects: unexpected HTTP', status, body.message ?? body);
  process.exit(1);
}

const redacted = {
  capturedAt: new Date().toISOString(),
  site_url: body.site_url ?? null,
  uri_allow_list: body.uri_allow_list ?? null,
  external_google_enabled: body.external?.google?.enabled ?? null,
  mailer_autoconfirm: body.mailer_autoconfirm ?? null,
};

mkdirSync(join(OUT, '..'), { recursive: true });
writeFileSync(OUT, JSON.stringify(redacted, null, 2));

let failures = 0;
const allowList = parseAllowList(redacted.uri_allow_list);

if (!redacted.site_url || !ACCEPTABLE_SITE_URL_PREFIXES.some((p) => redacted.site_url.startsWith(p))) {
  console.log('fail: site_url not an acceptable prod/dev origin:', redacted.site_url ?? '(missing)');
  failures++;
} else {
  console.log('ok: site_url', redacted.site_url);
}

for (const sub of REQUIRED_REDIRECT_SUBSTRINGS) {
  if (allowListCovers(allowList, sub)) console.log('ok: redirect allow list includes', sub);
  else {
    console.log('fail: redirect allow list missing', sub);
    failures++;
  }
}

if (redacted.external_google_enabled === false) {
  console.log('fail: Google provider disabled on fwor');
  failures++;
} else if (redacted.external_google_enabled === true) {
  console.log('ok: Google provider enabled');
} else {
  console.log('warn: could not read Google provider enabled flag');
}

console.log('verify-fwor-auth-redirects: wrote', OUT);
process.exit(failures > 0 ? 1 : 0);
