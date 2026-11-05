/**
 * Resolve Supabase Management API token (never log the value).
 *
 * `supabase login` stores a CLI session token (not valid for api.supabase.com).
 * Management API requires a Personal Access Token (`sbp_…`) from Dashboard → Account → Tokens.
 *
 * Order: SUPABASE_ACCESS_TOKEN env → supabase/.env.management.local → keychain if sbp_.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..', '..');

function isManagementPat(token) {
  return typeof token === 'string' && token.startsWith('sbp_') && token.length > 20;
}

function readPatFromManagementEnvFile() {
  const path = join(ROOT, 'supabase', '.env.management.local');
  if (!existsSync(path)) return '';
  const line = readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('SUPABASE_ACCESS_TOKEN='));
  if (!line) return '';
  const value = line.slice('SUPABASE_ACCESS_TOKEN='.length).trim().replace(/^["']|["']$/g, '');
  return isManagementPat(value) ? value : '';
}

export function resolveSupabaseAccessToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (isManagementPat(fromEnv)) return fromEnv;

  const fromFile = readPatFromManagementEnvFile();
  if (fromFile) return fromFile;

  try {
    const fromKeychain = execSync('security find-generic-password -s "Supabase CLI" -w', {
      encoding: 'utf8',
    }).trim();
    if (isManagementPat(fromKeychain)) return fromKeychain;
  } catch {
    /* no keychain entry */
  }

  return '';
}

export function managementTokenHelp() {
  return [
    'Management API needs a Personal Access Token (sbp_…), not the supabase login session token.',
    'Create one: Supabase Dashboard → Account → Access Tokens.',
    'Then either:',
    '  export SUPABASE_ACCESS_TOKEN=sbp_…',
    '  or add SUPABASE_ACCESS_TOKEN=sbp_… to supabase/.env.management.local (gitignored)',
  ].join('\n');
}

export async function fetchAuthConfig(projectRef, token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}
