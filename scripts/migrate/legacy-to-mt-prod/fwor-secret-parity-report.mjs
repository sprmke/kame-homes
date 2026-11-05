#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const OUT = join(ROOT, 'backups/legacy-prod-config/20261101/fwor-parity-report.txt');

const legacy = spawnSync(
  'bun',
  [
    'scripts/migrate/legacy-to-mt-prod/verify-secret-hashes.ts',
    '--digest-file',
    'backups/legacy-prod-config/20261101/fwor-secrets-digests.json',
  ],
  { cwd: ROOT, encoding: 'utf8' }
);
const local = spawnSync('bun', ['scripts/migrate/legacy-to-mt-prod/verify-fwor-secrets-from-local.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});

mkdirSync(join(OUT, '..'), { recursive: true });
writeFileSync(
  OUT,
  `# fwor parity reports — ${new Date().toISOString()}\n\n## vs supabase/.env.legacy-prod.local (legacy rollback)\nexit=${legacy.status}\n${legacy.stdout}${legacy.stderr}\n\n## vs supabase/.env.local (mt-prod target)\nexit=${local.status}\n${local.stdout}${local.stderr}`
);
console.log('fwor-secret-parity-report:', OUT, 'legacy_exit=', legacy.status, 'local_exit=', local.status);
