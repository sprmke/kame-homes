/**
 * Build session-pooler URL for the linked production project (fwor…).
 * Reads TARGET_DB_URL, or TARGET_DB_PASSWORD + ref from supabase/.env.local.
 * Prints the URL to stdout (caller must not log). Used by hosted verify scripts.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '../../..');
const MT_REF = process.env.MT_PROD_PROJECT_REF?.trim() || 'fworvijbrwpyngycotbz';

function readKey(file, key) {
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

const explicit = process.env.TARGET_DB_URL?.trim() || process.env.MT_PROD_DB_URL?.trim();
if (explicit) {
  process.stdout.write(explicit);
  process.exit(0);
}

const pw =
  readKey(path.join(ROOT, 'supabase/.env.local'), 'TARGET_DB_PASSWORD') ||
  readKey(path.join(ROOT, 'supabase/.env.prod.local'), 'TARGET_DB_PASSWORD');
const ref =
  readKey(path.join(ROOT, 'supabase/.env.local'), 'TARGET_DB_REF') ||
  readKey(path.join(ROOT, 'supabase/.env.prod.local'), 'MT_PROD_PROJECT_REF') ||
  MT_REF;

if (!pw) {
  console.error('resolve-target-db-url: set TARGET_DB_URL or TARGET_DB_PASSWORD in supabase/.env.local');
  process.exit(1);
}

let poolerHost = '';
try {
  const poolerLine = fs.readFileSync(path.join(ROOT, 'supabase/.temp/pooler-url'), 'utf8').trim();
  poolerHost = poolerLine.split('@')[1]?.split('/')[0] ?? '';
} catch {
  /* ignore */
}
if (!poolerHost) poolerHost = 'aws-0-ap-southeast-1.pooler.supabase.com';

process.stdout.write(`postgresql://postgres.${ref}:${encodeURIComponent(pw)}@${poolerHost}/postgres`);
