/**
 * Plan 02 R3 / §5.7 — read-only verify against hosted production DB (fwor…).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SQL_PATH = join(import.meta.dir, 'sql', '90-verify.sql');
const OUT_DIR = join(ROOT, 'backups/migration');
const TARGET_INV = join(OUT_DIR, 'inventory-fwor-hosted-latest.json');
const VERIFY_LOG = join(OUT_DIR, 'hosted-prod-verify.log');

function resolveDbUrl(): string {
  const fromEnv = process.env.TARGET_DB_URL?.trim() || process.env.DB_URL?.trim();
  if (fromEnv) return fromEnv;
  return execSync('bun scripts/migrate/legacy-to-mt-prod/resolve-target-db-url.mjs', {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--[^\n]*\n/gm, '').trim())
    .filter((s) => s.length > 0 && /\bselect\b/i.test(s));
}

async function main() {
  const structuralOnly =
    process.argv.includes('--structural-only') || process.env.CUTOVER_FREEZE_PAIR !== '1';
  const dbUrl = resolveDbUrl();
  mkdirSync(OUT_DIR, { recursive: true });

  execSync('bun scripts/migrate/legacy-to-mt-prod/inventory.ts', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DB_URL: dbUrl, INVENTORY_OUT: TARGET_INV },
  });

  const legacyInv =
    process.env.LEGACY_INVENTORY?.trim() ||
    join(ROOT, 'backups/migration/inventory-2026-10-31T19-27-14-855Z.json');

  let legacyFinance = '';
  try {
    legacyFinance = execSync(
      `bun scripts/migrate/legacy-to-mt-prod/verify/legacyFinanceCount.ts "${legacyInv}"`,
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    ).trim();
  } catch {
    legacyFinance = '';
  }

  let sql = readFileSync(SQL_PATH, 'utf8');
  sql = sql.replace(/:legacy_finance_line_items/g, legacyFinance ? `'${legacyFinance}'` : "''");

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const logLines: string[] = [];
  let failures = 0;
  for (const stmt of splitStatements(sql)) {
    const res = await client.query(stmt);
    for (const row of res.rows) {
      logLines.push(JSON.stringify(row));
      if ('failures' in row && Number(row.failures) > 0) {
        console.log(`${row.check}: FAIL (${row.failures})`);
        failures++;
      } else if ('failures' in row) {
        console.log(`${row.check}: ok`);
      } else if (row.check_name) {
        console.log(`${row.check_name}: ${row.status ?? row.count}`);
      }
    }
  }
  await client.end();
  writeFileSync(VERIFY_LOG, logLines.join('\n') + '\n');

  if (structuralOnly) {
    console.log(
      'hosted-prod-verify: skipping compareCounts (dual-track; set CUTOVER_FREEZE_PAIR=1 at T0 freeze)'
    );
  } else {
    execSync(
      `bun scripts/migrate/legacy-to-mt-prod/verify/compareCounts.ts "${legacyInv}" "${TARGET_INV}"`,
      {
        cwd: ROOT,
        stdio: 'inherit',
      }
    );
  }

  if (failures > 0) process.exit(1);
  console.log('hosted-prod-verify: ok');
}

main().catch((e) => {
  console.error('hosted-prod-verify failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
