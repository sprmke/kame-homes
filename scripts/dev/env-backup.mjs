#!/usr/bin/env bun
/**
 * Snapshot every real (gitignored) env file into `.env-backups/<stamp>/`.
 *
 *   bun run env:backup
 *   bun run env:backup -- --tag before-local-split
 *   bun run env:backup -- --list
 *
 * The copy keeps the relative path (`ui/.env.development`, `supabase/.env.local`, …),
 * is written with mode 600, and MANIFEST.json records sha256 + key names only.
 * Values never leave the files. Nothing is overwritten: a second run the same
 * second gets a `-2` suffix.
 */

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const BACKUP_ROOT = join(ROOT, '.env-backups');
const args = process.argv.slice(2);
const tagIndex = args.indexOf('--tag');
const TAG = tagIndex >= 0 ? args[tagIndex + 1] : '';
const LIST = args.includes('--list');

/** Env files worth protecting: real values, never `*.example` and never a folder. */
const TARGETS = ['ui', 'supabase', '.'];

function listEnvFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name === '.env' || name.startsWith('.env.'))
    .filter((name) => !name.endsWith('.example'))
    .filter((name) => {
      try {
        return statSync(join(dir, name)).isFile();
      } catch {
        return false;
      }
    })
    .map((name) => join(dir, name));
}

function parseKeys(raw) {
  const keys = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) keys.push(trimmed.slice(0, eq).trim());
  }
  return keys;
}

function stamp() {
  const now = new Date();
  const iso = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return TAG ? `${iso}_${TAG}` : iso;
}

if (LIST) {
  if (!existsSync(BACKUP_ROOT)) {
    console.log('No backups yet.');
    process.exit(0);
  }
  for (const entry of readdirSync(BACKUP_ROOT).sort().reverse()) {
    const manifest = join(BACKUP_ROOT, entry, 'MANIFEST.json');
    if (!existsSync(manifest)) continue;
    const data = JSON.parse(readFileSyncSafe(manifest));
    console.log(
      `${entry}  ${data.files?.length ?? 0} file(s)  ${data.tag ? `tag=${data.tag}` : ''}`
    );
  }
  process.exit(0);
}

function readFileSyncSafe(path) {
  return readFileSync(path, 'utf8');
}

const files = TARGETS.flatMap((dir) => listEnvFiles(join(ROOT, dir)));
if (files.length === 0) {
  console.error('No env files found. Nothing to back up.');
  process.exit(1);
}

let backupDir = join(BACKUP_ROOT, stamp());
for (let n = 2; existsSync(backupDir); n += 1) {
  backupDir = join(BACKUP_ROOT, `${stamp()}-${n}`);
}
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
chmodSync(backupDir, 0o700);

const manifest = {
  createdAt: new Date().toISOString(),
  tag: TAG || null,
  root: ROOT,
  files: [],
};

for (const source of files) {
  const rel = relative(ROOT, source);
  const dest = join(backupDir, rel);
  mkdirSync(join(dest, '..'), { recursive: true, mode: 0o700 });
  copyFileSync(source, dest);
  chmodSync(dest, 0o600);
  const raw = readFileSyncSafe(source);
  manifest.files.push({
    path: rel,
    bytes: Buffer.byteLength(raw),
    sha256: createHash('sha256').update(raw).digest('hex'),
    keys: parseKeys(raw),
  });
}

writeFileSync(join(backupDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
chmodSync(join(backupDir, 'MANIFEST.json'), 0o600);

console.log(`Backed up ${files.length} env file(s) → ${relative(ROOT, backupDir)}`);
for (const file of manifest.files) {
  console.log(
    `  ${file.path.padEnd(38)} ${String(file.keys.length).padStart(3)} keys  ${file.sha256.slice(0, 12)}`
  );
}
console.log('\nRestore one file with:  cp .env-backups/<stamp>/<path> <path>');
