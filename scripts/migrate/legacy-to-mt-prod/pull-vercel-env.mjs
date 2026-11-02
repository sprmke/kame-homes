#!/usr/bin/env bun
/**
 * Plan 01 B-11 (kame-homes) — pull Vercel env to gitignored backups (scratch link, no repo .vercel).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(import.meta.dir, '..', '..', '..');
const OUT = join(ROOT, 'backups/legacy-prod-config', '20261101');
const scope = process.env.VERCEL_SCOPE || 'kame-works';
const project = process.env.VERCEL_PROJECT || 'kame-homes';

const scratch = join(tmpdir(), `kame-vercel-pull-${Date.now()}`);
mkdirSync(scratch, { recursive: true });

execSync(`bun x vercel link --yes --project ${project} --scope ${scope}`, {
  cwd: scratch,
  stdio: 'inherit',
});

for (const env of ['production', 'preview', 'development']) {
  const file = join(scratch, `.env.vercel.${env}`);
  execSync(`bun x vercel env pull ${file} --environment=${env} --yes`, { cwd: scratch, stdio: 'inherit' });
  const dest = join(OUT, `vercel-${project}-${env}.env`);
  writeFileSync(dest, readFileSync(file, 'utf8'));
  const names = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1])
    .filter(Boolean);
  writeFileSync(join(OUT, `vercel-${project}-${env}.names.txt`), names.join('\n') + '\n');
  console.log(`${env}: ${names.length} vars → ${dest}`);
}

console.log('pull-vercel-env: ok');
