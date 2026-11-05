/**
 * D6 import from exportDevConfig JSON (upsert by property slug on target).
 *
 * Usage:
 *   DB_URL=… bun …/importConfig.ts backups/migration/d6-export-monaco-2604.json
 *   DRY_RUN=1 bun …/importConfig.ts …
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

type ExportPayload = {
  propertySlug: string;
  tables: Record<string, Record<string, unknown>[]>;
};

function dbUrl(): string {
  const u = process.env.DB_URL?.trim() || process.env.TARGET_DB_URL?.trim();
  if (!u) throw new Error('Set DB_URL or TARGET_DB_URL');
  return u;
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: importConfig.ts <export.json>');
    process.exit(2);
  }
  const payload = JSON.parse(readFileSync(path, 'utf8')) as ExportPayload;
  const dry = process.env.DRY_RUN === '1';

  const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const prop = await client.query<{ id: string }>(
    `select id from public.properties where slug = $1 limit 1`,
    [payload.propertySlug]
  );
  if (prop.rowCount === 0) throw new Error(`target missing property ${payload.propertySlug}`);
  const targetPropertyId = prop.rows[0].id;

  for (const [table, rows] of Object.entries(payload.tables)) {
    console.log(`${table}: ${rows.length} rows ${dry ? '(dry-run)' : ''}`);
    if (dry || rows.length === 0) continue;
    for (const row of rows) {
      const copy = { ...row, property_id: targetPropertyId };
      const cols = Object.keys(copy);
      const vals = cols.map((_, i) => `$${i + 1}`);
      const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
      await client.query(
        `insert into public.${table} (${cols.join(', ')})
         values (${vals.join(', ')})
         on conflict (id) do update set ${updates.join(', ')}`,
        cols.map((c) => copy[c])
      );
    }
  }

  await client.end();
  console.log('importConfig: ok');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
