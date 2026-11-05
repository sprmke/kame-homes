/**
 * Plan 01 B-07 — compare local legacy env values to Supabase secret digests (names + match only).
 *
 * Supabase hosted secrets use SHA-256 hex of the raw secret string (same as CLI `secrets list`).
 *
 * Usage:
 *   bun scripts/migrate/legacy-to-mt-prod/verify-secret-hashes.ts
 *   bun scripts/migrate/legacy-to-mt-prod/verify-secret-hashes.ts --digest-file backups/legacy-prod-config/20261101/secrets-digests.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const ENV_PATH = join(ROOT, 'supabase', '.env.legacy-prod.local');
const EXAMPLE_PATH = join(ROOT, 'supabase', '.env.legacy-prod.example');

function parseEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function templateKeys(): string[] {
  return readFileSync(EXAMPLE_PATH, 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
    .filter(Boolean) as string[];
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Parse `supabase secrets list` table or JSON export: name → digest hex */
function loadDigestFile(path: string): Record<string, string> {
  let raw = readFileSync(path, 'utf8');
  if (raw.trimStart().startsWith('[')) {
    const end = raw.lastIndexOf(']');
    if (end >= 0) raw = raw.slice(0, end + 1);
  }
  if (raw.trimStart().startsWith('{') || raw.trimStart().startsWith('[')) {
    const j = JSON.parse(raw) as { name: string; digest?: string; value?: string }[];
    const out: Record<string, string> = {};
    for (const row of j) {
      const hex = row.digest ?? row.value;
      if (row.name && hex) out[row.name] = hex.replace(/^sha256:/, '');
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && /^[A-Z][A-Z0-9_]+$/.test(parts[0])) {
      out[parts[0]] = parts[1].replace(/^sha256:/, '');
    }
  }
  return out;
}

const digestArg = process.argv.indexOf('--digest-file');
const digestRaw =
  digestArg >= 0
    ? process.argv[digestArg + 1]
    : join(ROOT, 'backups', 'legacy-prod-config', '20261101', 'secrets-digests.json');
const digestPath =
  digestRaw.startsWith('/') || digestRaw.startsWith('..') ? digestRaw : join(ROOT, digestRaw);

const local = parseEnv(ENV_PATH);
const keys = templateKeys();
const remote = existsSync(digestPath) ? loadDigestFile(digestPath) : null;

console.log('verify-secret-hashes');
console.log('  env file keys with values:', Object.keys(local).length);

if (!remote || Object.keys(remote).length === 0) {
  console.log(
    '  remote digests: unavailable (run supabase secrets list --project-ref zftt… → secrets-digests.json)'
  );
  for (const key of keys) {
    console.log(`  ${key}: ${local[key] ? 'local_set' : 'missing'}`);
  }
  process.exit(0);
}

let mismatches = 0;
for (const key of keys) {
  const val = local[key];
  const remoteDigest = remote[key];
  if (!val) {
    console.log(`  ${key}: missing_local`);
    continue;
  }
  if (!remoteDigest) {
    console.log(`  ${key}: not_on_host`);
    continue;
  }
  const localDigest = digest(val);
  if (localDigest === remoteDigest) {
    console.log(`  ${key}: match`);
  } else {
    console.log(`  ${key}: mismatch`);
    mismatches++;
  }
}
process.exit(mismatches > 0 ? 1 : 0);
