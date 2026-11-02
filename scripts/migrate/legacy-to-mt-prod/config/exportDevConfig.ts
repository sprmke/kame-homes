/**
 * D6 allow-list export keyed by property slug (read-only).
 *
 * Usage:
 *   DB_URL=… bun scripts/migrate/legacy-to-mt-prod/config/exportDevConfig.ts
 *   bun …/exportDevConfig.ts --out backups/migration/d6-export.json
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = join(import.meta.dir, '..', '..', '..', '..');
const ALLOW_PATH = join(import.meta.dir, 'allow-list.json');

function dbUrl(): string {
  const u = process.env.DB_URL?.trim() || process.env.TARGET_DB_URL?.trim();
  if (!u) throw new Error('Set DB_URL or TARGET_DB_URL');
  return u;
}

async function main() {
  const allow = JSON.parse(readFileSync(ALLOW_PATH, 'utf8')) as {
    propertySlug: string;
    tables: string[];
  };
  const outArg = process.argv.indexOf('--out');
  const outPath =
    outArg >= 0
      ? process.argv[outArg + 1]
      : join(ROOT, 'backups/migration', `d6-export-${allow.propertySlug}.json`);

  const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const prop = await client.query<{ id: string; slug: string }>(
    `select id, slug from public.properties where slug = $1 limit 1`,
    [allow.propertySlug]
  );
  if (prop.rowCount === 0) throw new Error(`property slug not found: ${allow.propertySlug}`);
  const propertyId = prop.rows[0].id;

  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    propertySlug: allow.propertySlug,
    propertyId,
    tables: {} as Record<string, unknown[]>,
  };

  for (const table of allow.tables) {
    const reg = await client.query(
      `select 1 from information_schema.columns
       where table_schema = 'public' and table_name = $1 and column_name = 'property_id'`,
      [table]
    );
    if (reg.rowCount === 0) {
      console.warn(`skip ${table}: no property_id column`);
      continue;
    }
    const rows = await client.query(`select * from public.${table} where property_id = $1`, [
      propertyId,
    ]);
    (payload.tables as Record<string, unknown[]>)[table] = rows.rows;
    console.log(`${table}: ${rows.rowCount} rows`);
  }

  await client.end();
  mkdirSync(join(outPath, '..'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
