/**
 * Phase 1 — local checks for prod wiring artifacts (no secret values printed).
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const FWOR = 'fworvijbrwpyngycotbz';
let failures = 0;
function ok(msg: string) {
  console.log(`ok: ${msg}`);
}
function fail(msg: string) {
  console.log(`fail: ${msg}`);
  failures++;
}

const legacyEnv = join(ROOT, 'supabase', '.env.legacy-prod.local');
const uiLegacy = join(ROOT, 'ui', '.env.legacy-prod.local');
if (existsSync(legacyEnv)) ok('supabase/.env.legacy-prod.local present');
else fail('supabase/.env.legacy-prod.local missing');

if (existsSync(uiLegacy)) ok('ui/.env.legacy-prod.local present');
else fail('ui/.env.legacy-prod.local missing');

try {
  const guard = readFileSync(join(ROOT, 'scripts/dev/check-linked-project.sh'), 'utf8');
  if (guard.includes(FWOR)) ok('check-linked-project.sh knows fwor ref');
  else fail('check-linked-project.sh missing fwor ref');
} catch {
  fail('check-linked-project.sh unreadable');
}

try {
  const out = execSync('gh secret list --env production 2>/dev/null', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const names = out
    .split('\n')
    .map((l) => l.split(/\s+/)[0])
    .filter(Boolean);
  const required = ['SUPABASE_PROJECT_REF', 'LEGACY_PROD_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN'];
  if (names.length === 0) {
    console.log('skip: gh production secrets not visible (empty list or no access)');
  } else {
    for (const key of required) {
      if (names.includes(key)) ok(`GitHub production has ${key}`);
      else fail(`GitHub production missing ${key}`);
    }
  }
} catch {
  console.log('skip: gh secret list --env production (install gh / auth)');
}

const vercelProd = join(
  ROOT,
  'backups/legacy-prod-config/20261101/vercel-kame-homes-production.env'
);
if (existsSync(vercelProd)) {
  const text = readFileSync(vercelProd, 'utf8');
  if (text.includes('fworvijbrwpyngycotbz')) ok('Vercel kame-homes Production points at fwor');
  else fail('Vercel kame-homes Production missing fwor ref');
} else {
  console.log('skip: run pull-vercel-env.mjs for Vercel production audit file');
}

try {
  const authVerify = execSync(
    'bun scripts/migrate/legacy-to-mt-prod/verify-fwor-auth-redirects.mjs',
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  for (const line of authVerify.trim().split('\n')) {
    if (line.startsWith('ok:')) ok(line.slice(4).trim());
    else if (line.startsWith('fail:')) fail(line.slice(6).trim());
    else if (line.startsWith('warn:')) console.log(`warn: ${line.slice(6).trim()}`);
  }
} catch (e: unknown) {
  const err = e as { status?: number; stderr?: string; stdout?: string };
  if (err.status === 2) {
    console.log(
      'skip: fwor Auth redirect verify (no valid SUPABASE_ACCESS_TOKEN — run supabase login or export token, then verify-fwor-auth-redirects.mjs)'
    );
  } else {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    fail(`fwor Auth redirect verify failed${out ? `: ${out.split('\n')[0]}` : ''}`);
  }
}

console.log(
  'verify-phase1-wiring: optional — Auth Site URL → kamespace.com at T0; legacy Vercel pull (sprmke team); B-17 scratch project'
);
process.exit(failures > 0 ? 1 : 0);
