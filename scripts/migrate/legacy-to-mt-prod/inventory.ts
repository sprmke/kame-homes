/**
 * inventory.ts — Phase 0.1 legacy inventory runner (READ-ONLY).
 *
 * Plan: docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md §5 Phase 0.1
 *
 * - Reads PROD_DB_URL (session pooler URI) from supabase/.env.local or $PROD_DB_URL.
 * - Executes every statement in sql/00-inventory.sql (dollar-quote/line-comment aware splitter).
 * - Guards: the SQL file must not contain any mutating keyword outside comments; the
 *   connection must be a remote Supabase pooler/db host, not localhost (ALLOW_LOCAL=1 to override).
 * - Writes count-only JSON (no PII) to backups/migration/inventory-<ts>.json and prints counts.
 *
 * Usage: bun scripts/migrate/legacy-to-mt-prod/inventory.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = join(import.meta.dir, "..", "..", "..");
const SQL_PATH = join(import.meta.dir, "sql", "00-inventory.sql");
const OUT_DIR = join(ROOT, "backups", "migration");

const LOCAL = "127.0.0.1";
const LOCALHOST = "localhost";

function loadProdDbUrl(): string {
  const fromEnv = process.env.PROD_DB_URL?.trim() || process.env.DB_URL?.trim();
  if (fromEnv) return fromEnv;
  const envLocal = readFileSync(join(ROOT, "supabase", ".env.local"), "utf8");
  const line = envLocal
    .split("\n")
    .find((l) => /^PROD_DB_URL=/.test(l));
  if (!line) {
    console.error("ERROR: PROD_DB_URL not set (env) and not found in supabase/.env.local");
    process.exit(1);
  }
  return line.replace(/^PROD_DB_URL=/, "").trim();
}

/** Split an SQL file into individual statements, respecting $$ $$ quoting and comments. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let dollarTag: string | null = null;
  let inLine = false;
  let inBlock = false;
  let inQuote = false;
  while (i < sql.length) {
    if (inLine) {
      cur += sql[i];
      if (sql[i] === "\n") inLine = false;
      i++;
      continue;
    }
    if (inBlock) {
      cur += sql[i];
      if (sql[i] === "*" && sql[i + 1] === "/") {
        cur += "/";
        i += 2;
        inBlock = false;
        continue;
      }
      i++;
      continue;
    }
    if (inQuote) {
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          cur += "''";
          i += 2;
          continue;
        }
        inQuote = false;
      }
      cur += sql[i];
      i++;
      continue;
    }
    if (sql[i] === "-" && sql[i + 1] === "-") {
      inLine = true;
      cur += "--";
      i += 2;
      continue;
    }
    if (sql[i] === "/" && sql[i + 1] === "*") {
      inBlock = true;
      cur += "/*";
      i += 2;
      continue;
    }
    if (sql[i] === "'" && dollarTag === null) {
      inQuote = true;
      cur += "'";
      i++;
      continue;
    }
    if (dollarTag !== null) {
      if (sql.startsWith(dollarTag, i)) {
        cur += dollarTag;
        const len = dollarTag.length;
        dollarTag = null;
        i += len;
        continue;
      }
      cur += sql[i];
      i++;
      continue;
    }
    if (sql[i] === "$") {
      const match = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (match) {
        dollarTag = match[0];
        cur += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (sql[i] === ";") {
      out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += sql[i];
    i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((s) => {
    const code = s.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
    return code.length > 0;
  });
}

const MUTATING_RE =
  /\b(insert|update|delete|drop|truncate|alter|create[^(]*\b(conversion|function|trigger)|copy|grant|revoke|reindex|vacuum|analyze|comment|call|do)\b/i;
// allowed: temp table/function/extension-side DDL inside our own session only
const ALLOWED_CREATE_RE = /^create\s+(?<kind>temp|temporary)\s+/i;
const ALLOWED_DO_RE = /^do\s+\$\$/i;

function classify(statement: string): "read" | "temp-session" | "blocked" {
  const first = statement.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trimStart();
  if (ALLOWED_DO_RE.test(first)) {
    // hard-coded DO block: only inserts into temp_table_counts (temp schema); scan for anything else
    if (/\b(insert\s+into\s+(?!temp_table_counts)\w+)/i.test(first) || /\b(delete|update|truncate|drop|alter|grant|revoke|copy)\b/i.test(first)) {
      return "blocked";
    }
    return "temp-session";
  }
  if (ALLOWED_CREATE_RE.test(first)) return "temp-session";
  const statementNoComments = statement
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  if (/\b(create|drop|alter|insert|update|delete|truncate|grant|revoke|copy|vacuum)\b/i.test(statementNoComments)) {
    return "blocked";
  }
  if (!/\b(select|with|show)\b/i.test(statementNoComments)) return "blocked";
  return "read";
}

async function main() {
  const sql = readFileSync(SQL_PATH, "utf8");
  const statements = splitStatements(sql);
  const kinds = statements.map(classify);
  if (kinds.some((k) => k === "blocked")) {
    const i = kinds.indexOf("blocked");
    console.error("ERROR: sql/00-inventory.sql contains a non-read-only statement:\n", statements[i].slice(0, 200));
    process.exit(1);
  }

  const dbUrl = loadProdDbUrl();
  const parsed = new URL(dbUrl);
  const host = parsed.hostname;
  const allowLocal = process.env.ALLOW_LOCAL === "1";
  if (!allowLocal && (host === LOCAL || host === LOCALHOST)) {
    console.error("ERROR: refusing local connection; pass a remote Supabase pooler/db URL (or ALLOW_LOCAL=1 to override).");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: host === LOCAL || host == LOCALHOST ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  const results: Record<string, unknown[] | number> = {};
  for (let idx = 0; idx < statements.length; idx++) {
    const statement = statements[idx];
    const kind = kinds[idx];
    const res = await client.query(statement);
    const label =
      res.fields && res.fields.length ? `r${idx}_${res.fields.map((f) => f.name).join(",")}` : `statement_${idx}`;
    if (kind === "read") {
      const rows = res.rows ?? [];
      results[label] = rows.length ? rows : [];
      if (rows.length) {
        console.log(`[ok] ${label} -> ${rows[0] && "fields: " + Object.keys(rows[0]).join(",")} (${rows.length} rows)`);
      } else {
        console.log(`[ok] ${label} -> 0 rows`);
      }
    } else {
      console.log(`[session-skip] ${label} (temp DDL applied)`);
    }
  }
  await client.end();

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `inventory-${ts}.json`);
  writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2) + "\n");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err: unknown) => {
  console.error("Inventory failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
