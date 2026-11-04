#!/usr/bin/env node
/**
 * Read-only Supabase database metrics snapshot.
 *
 * Plan: docs/workflow/planned/supabase-capacity-and-operational-readiness.md
 *
 * Wraps `supabase inspect db ... --linked`, which uses the read-only
 * Postgres statistics views (pg_stat_statements, pg_stat_user_tables, ...).
 * It never writes to the database and never prints secrets.
 *
 * Usage:
 *   bun run perf:supabase:metrics
 *   SUPABASE_CLI=/opt/homebrew/bin/supabase bun run perf:supabase:metrics
 *   SUPABASE_METRICS_DIR=/tmp/supa bun run perf:supabase:metrics
 *
 * Output defaults to .artifacts/supabase-metrics/<ISO timestamp>/ (gitignored).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMANDS = [
  'db-stats',
  'calls',
  'outliers',
  'table-stats',
  'table-record-counts',
  'index-stats',
  'seq-scans',
  'bloat',
  'vacuum-stats',
  'long-running-queries',
  'locks',
  'blocking',
  'traffic-profile',
];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = process.env.SUPABASE_CLI ?? 'supabase';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir =
  process.env.SUPABASE_METRICS_DIR ?? join(repoRoot, '.artifacts', 'supabase-metrics', stamp);

function readProjectRef() {
  try {
    return readFileSync(join(repoRoot, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
  } catch {
    return process.env.SUPABASE_PROJECT_REF ?? 'unknown';
  }
}

mkdirSync(outDir, { recursive: true });

const manifest = {
  capturedAt: new Date().toISOString(),
  projectRef: readProjectRef(),
  cli,
  commands: [],
  failures: [],
};

for (const command of COMMANDS) {
  const args = ['inspect', 'db', command, '--linked'];
  try {
    const stdout = execFileSync(cli, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    writeFileSync(join(outDir, `${command}.txt`), stdout);
    manifest.commands.push({ command, bytes: Buffer.byteLength(stdout) });
  } catch (error) {
    const message = String(error?.stderr || error?.message || error);
    manifest.failures.push({ command, message: message.slice(0, 500) });
    process.stderr.write(`[supabase-metrics] ${command} failed: ${message.split('\n')[0]}\n`);
  }
}

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(
  `[supabase-metrics] ${manifest.commands.length}/${COMMANDS.length} snapshots in ${outDir}\n`
);
if (manifest.failures.length > 0) {
  process.stdout.write(
    `[supabase-metrics] ${manifest.failures.length} command(s) failed; see manifest.json\n`
  );
}
// Only a total connection failure should fail CI. A single unsupported
// subcommand on an older CLI is not a capacity signal.
if (manifest.commands.length === 0) process.exitCode = 1;
