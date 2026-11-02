#!/usr/bin/env bun
/**
 * Phase 1.4 — PATCH fwor Auth URL config (Management API).
 * Production mutation: run only with KAMEWAVE=kamewave in the environment (shell hooks + this check).
 *
 * Example:
 *   KAMEWAVE=kamewave SUPABASE_ACCESS_TOKEN=sbp_... bun scripts/migrate/legacy-to-mt-prod/apply-fwor-auth-phase1.mjs
 */
import { resolveSupabaseAccessToken, fetchAuthConfig } from './lib/supabaseManagementToken.mjs';

const REF = 'fworvijbrwpyngycotbz';

if (process.env.KAMEWAVE !== 'kamewave') {
  console.error('apply-fwor-auth-phase1: refused — set KAMEWAVE=kamewave in the same shell command');
  process.exit(42);
}

const token = resolveSupabaseAccessToken();
if (!token) {
  console.error('apply-fwor-auth-phase1: SUPABASE_ACCESS_TOKEN or supabase login required');
  process.exit(2);
}

const siteUrl = process.env.AUTH_SITE_URL?.trim() || 'https://dev.kamehomes.space';
const extraRedirects = [
  'https://dev.kamehomes.space/**',
  'https://app.kamehomes.space/**',
  'https://kamespace.com/**',
  'http://localhost:5173/**',
];

const { status: getStatus, body: current } = await fetchAuthConfig(REF, token);
if (getStatus !== 200) {
  console.error('apply-fwor-auth-phase1: GET auth config failed', getStatus, current.message ?? current);
  process.exit(1);
}

const existing = (current.uri_allow_list ?? '')
  .split(/[\n,]/)
  .map((s) => s.trim())
  .filter(Boolean);
const merged = [...new Set([...existing, ...extraRedirects])];

const patch = {
  site_url: siteUrl,
  uri_allow_list: merged.join('\n'),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(patch),
});

const text = await res.text();
if (!res.ok) {
  console.error('apply-fwor-auth-phase1: PATCH failed', res.status, text.slice(0, 500));
  process.exit(1);
}

console.log('apply-fwor-auth-phase1: ok site_url=', siteUrl, 'allow_list_entries=', merged.length);
