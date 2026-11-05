/**
 * Plan 01 B-09 / B-10 — read-only legacy Supabase capture into backups/legacy-prod-config/<date>/.
 * Never prints secret values to stdout (JSON files are gitignored).
 *
 * Usage: bun scripts/migrate/legacy-to-mt-prod/capture-legacy-config.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = join(import.meta.dir, '..', '..', '..');
const LEGACY_REF = 'zfttdwtceyqszyeyhilc';
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const OUT_DIR = join(ROOT, 'backups', 'legacy-prod-config', DATE);

function loadProdDbUrl(): string {
  const fromEnv = process.env.PROD_DB_URL?.trim();
  if (fromEnv) return fromEnv;
  const envLocal = readFileSync(join(ROOT, 'supabase', '.env.local'), 'utf8');
  const line = envLocal.split('\n').find((l) => /^PROD_DB_URL=/.test(l));
  if (!line) throw new Error('PROD_DB_URL missing');
  const url = line
    .replace(/^PROD_DB_URL=/, '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (!url.includes(LEGACY_REF) && !url.includes('pooler.supabase.com')) {
    throw new Error('PROD_DB_URL does not look like legacy pooler URL');
  }
  return url;
}

function refFromUrl(url: string): string {
  try {
    const u = new URL(url.replace(/^postgres:/, 'postgresql:'));
    const user = u.username || '';
    if (u.hostname.endsWith('pooler.supabase.com') && user.startsWith('postgres.')) {
      return user.split('.')[1] ?? '';
    }
    if (u.hostname.endsWith('.supabase.co'))
      return u.hostname.split('.')[0]?.replace(/^db\./, '') ?? '';
  } catch {
    /* ignore */
  }
  return '';
}

async function main() {
  const dbUrl = loadProdDbUrl();
  const ref = refFromUrl(dbUrl);
  if (ref && ref !== LEGACY_REF) {
    throw new Error(`Refusing: PROD_DB_URL ref is ${ref}, expected ${LEGACY_REF}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cron = await client.query(
    `select jobid, jobname, schedule, command from cron.job order by jobname`
  );
  writeFileSync(join(OUT_DIR, 'cron-jobs.json'), JSON.stringify(cron.rows, null, 2));

  const buckets = await client.query(
    `select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by name`
  );
  writeFileSync(join(OUT_DIR, 'storage-buckets.json'), JSON.stringify(buckets.rows, null, 2));

  const extensions = await client.query(
    `select extname, extversion from pg_extension order by extname`
  );
  writeFileSync(join(OUT_DIR, 'pg-extensions.json'), JSON.stringify(extensions.rows, null, 2));

  const vaultNames = await client
    .query(`select name from vault.secrets order by name`)
    .catch(() => ({
      rows: [] as { name: string }[],
    }));
  writeFileSync(join(OUT_DIR, 'vault-secret-names.json'), JSON.stringify(vaultNames.rows, null, 2));

  const configTables = [
    'app_settings',
    'telegram_admin_settings',
    'telegram_staff_settings',
    'telegram_finance_settings',
    'telegram_maintenance_settings',
    'telegram_marketing_settings',
    'gmail_listener_state',
    'gmail_mail_integration',
  ] as const;

  const counts: Record<string, number> = {};
  for (const table of configTables) {
    const r = await client.query(`select * from public.${table}`);
    counts[table] = r.rowCount ?? r.rows.length;
    writeFileSync(join(OUT_DIR, `${table}.json`), JSON.stringify(r.rows, null, 2));
  }

  await client.end();

  const summary = {
    captured_at: new Date().toISOString(),
    legacy_ref: LEGACY_REF,
    out_dir: OUT_DIR.replace(ROOT + '/', ''),
    cron_jobs: cron.rowCount,
    storage_buckets: buckets.rowCount,
    extensions: extensions.rowCount,
    vault_secret_names: vaultNames.rows.length,
    config_row_counts: counts,
  };
  writeFileSync(join(OUT_DIR, 'capture-summary.json'), JSON.stringify(summary, null, 2));

  const manifestSha = createHash('sha256').update(JSON.stringify(summary)).digest('hex');
  writeFileSync(join(OUT_DIR, 'capture-summary.sha256'), manifestSha + '\n');

  console.log('capture-legacy-config: ok');
  console.log('  dir:', summary.out_dir);
  console.log('  cron jobs:', summary.cron_jobs);
  console.log('  buckets:', summary.storage_buckets);
  console.log('  config rows:', JSON.stringify(counts));
}

main().catch((e) => {
  console.error('capture-legacy-config failed:', e.message);
  process.exit(1);
});
