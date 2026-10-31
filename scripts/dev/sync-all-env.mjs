#!/usr/bin/env bun
/**
 * Keep UI + Supabase + Vercel (kame-homes) env files in sync.
 *
 * 1. reorganize-env-files — consistent sections, drop denylisted keys
 * 2. sync-dev-env — merge UI/edge locals, push Supabase DEV secrets
 * 3. sync-vercel-dev-env — push ui/.env.development.dev → Vercel
 *
 * Usage:
 *   bun run env:sync:all
 *   bun run env:sync:all -- --dry-run
 *   bun run env:sync:all -- --skip-remote   # local files only
 *   bun run env:sync:all -- --skip-vercel   # skip Vercel push
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const args = process.argv.slice(2);
const passthrough = args.filter((a) => a.startsWith('--'));

function run(label, script, extraArgs = []) {
  console.log(`\n=== ${label} ===`);
  const res = spawnSync('bun', [join('scripts/dev', script), ...passthrough, ...extraArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    console.error(`${label} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

run('Reorganize env files', 'reorganize-env-files.mjs');
run('Sync local + Supabase DEV', 'sync-dev-env.mjs');

if (!passthrough.includes('--skip-vercel')) {
  run('Sync Vercel (kame-homes)', 'sync-vercel-dev-env.mjs');
} else {
  console.log('\n=== Skip Vercel (--skip-vercel) ===');
}

console.log('\nenv sync complete.');
