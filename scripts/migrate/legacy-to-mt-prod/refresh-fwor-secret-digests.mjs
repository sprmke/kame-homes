#!/usr/bin/env bun
/** Dump fwor edge secret digests (SHA-256) for verify scripts. Requires sbp_ PAT. */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSupabaseAccessToken } from './lib/supabaseManagementToken.mjs';

const ROOT = join(import.meta.dir, '..', '..', '..');
const REF = 'fworvijbrwpyngycotbz';
const OUT = join(ROOT, 'backups/legacy-prod-config/20261101/fwor-secrets-digests.json');

const token = resolveSupabaseAccessToken();
if (!token) {
  console.error('refresh-fwor-secret-digests: no sbp_ PAT (see supabase/.env.management.local)');
  process.exit(2);
}

const json = execSync(
  `supabase secrets list --project-ref ${REF} -o json`,
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  }
);
mkdirSync(join(OUT, '..'), { recursive: true });
writeFileSync(OUT, json.trim() + '\n');
console.log('refresh-fwor-secret-digests: wrote', OUT);
