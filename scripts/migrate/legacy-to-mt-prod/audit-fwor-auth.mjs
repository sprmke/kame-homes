#!/usr/bin/env bun
/** Read-only fwor Auth config snapshot (no secrets) → gitignored backups. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchAuthConfig,
  resolveSupabaseAccessToken,
} from './lib/supabaseManagementToken.mjs';

const ROOT = join(import.meta.dir, '..', '..', '..');
const OUT = join(ROOT, 'backups/legacy-prod-config/20261101/fwor-auth-config-redacted.json');
const REF = 'fworvijbrwpyngycotbz';

const token = resolveSupabaseAccessToken();
if (!token) {
  console.error('audit-fwor-auth: no token — export SUPABASE_ACCESS_TOKEN or run supabase login');
  process.exit(2);
}

const { status, body } = await fetchAuthConfig(REF, token);
if (status === 401) {
  console.error('audit-fwor-auth: Management API 401 — refresh supabase login or set SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}
if (status !== 200) {
  console.error('audit-fwor-auth: HTTP', status, body.message ?? body);
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
console.log('audit-fwor-auth: wrote', OUT);
console.log(JSON.stringify(redacted, null, 2));
