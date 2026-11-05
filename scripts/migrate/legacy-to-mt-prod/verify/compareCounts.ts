/**
 * compareCounts.ts — legacy inventory vs target DB, per table (Plan §2 verify).
 *
 * Reads the Phase 0.1 inventory JSON (counts only) and compares against the
 * restored/upgraded target database over the local docker psql (rehearsal) or
 * a TARGET_DB_URL (mt-prod). Exits non-zero on any mismatch.
 *
 * Usage:
 *   bun scripts/migrate/legacy-to-mt-prod/verify/compareCounts.ts \
 *     backups/migration/r1-20261024/inventory.json backups/migration/<target-inventory.json>
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [legacyJsonPath, targetJsonPath] = process.argv.slice(2);
if (!legacyJsonPath || !targetJsonPath) {
  console.error("Usage: bun compareCounts.ts <legacy-inventory.json> <target-inventory.json>");
  process.exit(2);
}

const legacy = JSON.parse(readFileSync(legacyJsonPath, "utf8")).results;
const target = JSON.parse(readFileSync(targetJsonPath, "utf8")).results;

// Inventory runner keys result sets as "r<n>_<fields>". Resolve by field shape instead of index.
function frame(resultSets: Record<string, unknown[]>, fields: string | string[]): Record<string, unknown>[] {
  const wanted = Array.isArray(fields) ? fields.join(",") : fields;
  const key = Object.keys(resultSets).find((k) => k.endsWith(wanted));
  if (!key) throw new Error(`inventory frame not found: ${wanted}`);
  return resultSets[key] as Record<string, unknown>[];
}

function tablesBy(resultSets: Record<string, unknown[]>): Map<string, number> {
  const rows = frame(resultSets, "table_name,row_count,size_bytes") as {
    table_name: string;
    row_count: number;
  }[];
  return new Map(rows.map((r) => [r.table_name, Number(r.row_count)]));
}

function single(resultSets: Record<string, unknown[]>, fields: string[], keyField: string): number {
  const rows = frame(resultSets, fields);
  const first = rows[0] ?? {};
  const v = Number((first as Record<string, unknown>)[keyField]);
  if (!Number.isFinite(v)) throw new Error(`frame ${fields} missing ${keyField}`);
  return v;
}

// Tables the develop chain intentionally drops (retired legacy-only features).
// Plan §1: Gmail listener retired (Resend inbound), legacy backup table unused.
const DROPPED_ON_UPGRADE = new Set([
  "gmail_listener_state",
  "gmail_mail_oauth_state",
  "gmail_mail_integration",
  "guest_submissions_backup_20260501",
]);

let failures = 0;
const mismatches: string[] = [];

// 1. public tables
const lt = tablesBy(legacy);
const tt = tablesBy(target);
for (const [name, count] of lt) {
  if (DROPPED_ON_UPGRADE.has(name)) continue;
  const targetCount = tt.get(name);
  if (targetCount !== count) {
    failures += 1;
    mismatches.push(`table ${name}: legacy=${count} target=${targetCount}`);
  }
}
// 2. auth
const legacyUsers = single(legacy, "users", "users");
const targetUsers = single(target, "users", "users");
if (legacyUsers !== targetUsers) mismatches.push(`auth.users: legacy=${legacyUsers} target=${targetUsers}`);
function identSum(resultSets: Record<string, unknown[]>): number {
  return frame(resultSets, "provider,identities").reduce((acc, r) => acc + Number((r as { identities: number }).identities), 0);
}
const legacyIdent = identSum(legacy);
const targetIdent = identSum(target);
if (legacyIdent !== targetIdent) mismatches.push(`auth.identities: legacy=${legacyIdent} target=${targetIdent}`);

// 3. storage buckets
function bucketsBy(resultSets: Record<string, unknown[]>): Map<string, { count: number; bytes: number }> {
  const rows = frame(resultSets, "bucket,objects,bytes") as { bucket: string; objects: number; bytes: string }[];
  return new Map(rows.map((r) => [r.bucket, { count: Number(r.objects), bytes: Number(r.bytes) }]));
}
const lb = bucketsBy(legacy);
const tb = bucketsBy(target);
for (const [b, v] of lb) {
  const got = tb.get(b);
  if (!got || got.count !== v.count || got.bytes !== v.bytes) {
    // bucket object counts are a storage-mediated value: rows restored from the
    // metadata dump match legacy; failures here mean a broken bucket copy
    mismatches.push(`storage.${b}: legacy=${v.count}/${v.bytes} target=${got ? `${got.count}/${got.bytes}` : "missing"}`);
  }
}

// 4. bookings status distribution (informational diff, statuses may evolve)
function statusFrame(resultSets: Record<string, unknown[]>): Map<string, number> {
  const rows = frame(resultSets, "status,count") as unknown as { status: string; count: number }[];
  return new Map(rows.map((r) => [(r as { status: string }).status, Number((r as { count: number }).count)]));
}
const ls = statusFrame(legacy);
const ts0 = frame(target, "status,count") as unknown as { status: string; count: number }[];
const ts = new Map(ts0.map((r) => [r.status, Number(r.count)]));
for (const [s, c] of ls) {
  if (ts.get(s) !== c) mismatches.push(`bookings.${s}: legacy=${c} target=${ts.get(s) ?? 0}`);
}

if (mismatches.length > 0) {
  failures += mismatches.length;
  for (const m of mismatches) console.error(`MISMATCH ${m}`);
  console.error(`compareCounts: ${mismatches.length} mismatches`);
  process.exit(1);
}
console.log("compareCounts: all counts match");
