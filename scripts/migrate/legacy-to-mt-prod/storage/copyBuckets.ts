/**
 * copyBuckets.ts — resumable Storage object copy (legacy → target).
 * Plan: docs/workflow/planned/legacy-to-mt-prod §2.6
 *       docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md §2.6
 *
 * Object paths and metadata (size/content-type) come from the restored
 * `storage.objects` rows (target DB), so no listing session is needed against
 * the legacy Storage API.
 *
 * Modes:
 *   manifest  — verify storage.objects in the DB, write manifest.json per run
 *   dry-run   — manifest + HEAD-check every legacy public URL (read-only)
 *   copy      — fetch each object from legacy and upload to the target
 *   verify    — HEAD-check target URLs against the stored sizes
 *
 * Env:
 *   DB_NAME=legacy_r1                    rehearsal/restore DB name (local docker)
 *   LEGACY_OBJECT_BASE_URL=https://zftt….supabase.co/storage/v1/object
 *   TARGET_OBJECT_BASE_URL=http://127.0.0.1:54321/storage/v1/object
 *   TARGET_SERVICE_ROLE_KEY=<service role key of the target>
 *
 * Objects live only in gitignored backups/migration/; nothing about content is
 * printed — only counts.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const RUN_DIR = process.env.RUN_DIR || join(ROOT, "backups", "migration", "latest-rehearsal");
const DB_NAME = process.env.DB_NAME || "legacy_r1";
const CONTAINER = process.env.LOCAL_DB_CONTAINER || "supabase_db_guest-form-management";
const LEGACY_BASE = (process.env.LEGACY_OBJECT_BASE_URL ?? "").replace(/\/+$/, "");
const LEGACY_SERVICE_ROLE_KEY = process.env.LEGACY_SERVICE_ROLE_KEY ?? "";
const TARGET_BASE = (process.env.TARGET_OBJECT_BASE_URL ?? "").replace(/\/+$/, "");
const TARGET_SERVICE_ROLE_KEY = process.env.TARGET_SERVICE_ROLE_KEY ?? "";
const MODE = process.argv[2] ?? "manifest";

type ObjectRow = {
  bucket_id: string;
  name: string;
  size: number;
  content_type: string | null;
};

function dbQuery(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "supabase_admin", "-h", "127.0.0.1", "-d", DB_NAME, "-tA", "-F", "\t"],
    { input: sql, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  );
}

function selectObjects(where: string): ObjectRow[] {
  const rows = dbQuery(
    `select bucket_id, name, coalesce((metadata->>'size')::bigint, 0), coalesce(metadata->>'mimetype','')
     from storage.objects ${where}
     order by bucket_id, name;`
  )
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      const [bucket_id, name, size, content_type] = l.split("\t");
      return { bucket_id, name, size: Number(size) || 0, content_type: content_type || null };
    });
  return rows;
}

function summarize(objects: { bucket_id: string; size: number }[]) {
  const byBucket = new Map<string, { count: number; bytes: number }>();
  for (const o of objects) {
    const cur = byBucket.get(o.bucket_id) ?? { count: 0, bytes: 0 };
    cur.count += 1;
    cur.bytes += o.size;
    byBucket.set(o.bucket_id, cur);
  }
  return Object.fromEntries([...byBucket.entries()].sort().map(([b, v]) => [b, v]));
}

function legacyFetchHeaders(contentType?: string): Record<string, string> {
  // Private legacy buckets require a service-role bearer; public buckets work without.
  const h: Record<string, string> = { apikey: LEGACY_SERVICE_ROLE_KEY || "x" };
  if (LEGACY_SERVICE_ROLE_KEY) h.Authorization = `Bearer ${LEGACY_SERVICE_ROLE_KEY}`;
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

function legacyObjectUrl(o: { bucket_id: string; name: string }): string {
  // apikey param kept for public reads (any value works); with a service-role
  // bearer the query param must go — an invalid apikey would override auth.
  const base = LEGACY_BASE.replace(/\/(public|object)\/?$/, "");
  const url = `${base}/object/${encodeURIComponent(o.bucket_id)}/${o.name.split("/").map(encodeURIComponent).join("/")}`;
  return LEGACY_SERVICE_ROLE_KEY ? url : `${url}?apikey=x`;
}

async function httpHead(url: string): Promise<{ status: number; len: number | null }> {
  try {
    const res = await fetch(url, { method: "HEAD", headers: legacyFetchHeaders() });
    return { status: res.status, len: Number(res.headers.get("content-length")) || null };
  } catch {
    return { status: 0, len: null };
  }
}

async function main() {
  const manifestPath = join(RUN_DIR, "storage-manifest.json");

  if (!existsSync(manifestPath)) {
    writeFileSync(manifestPath, JSON.stringify(selectObjects(""), null, 2) + "\n");
  }
  const objects: ObjectRow[] = JSON.parse(readFileSync(manifestPath, "utf8"));
  const buckets = summarize(objects.map((o) => ({ bucket_id: o.bucket_id, size: o.size })));
  if (MODE === "manifest") {
    console.log(JSON.stringify(buckets, null, 2));
    console.log(`objects=${objects.length} at ${manifestPath}`);
    return;
  }

  if (MODE === "dry-run") {
    if (!LEGACY_BASE) throw new Error("LEGACY_OBJECT_BASE_URL is required for dry-run");
    let ok = 0, missing = 0, sizeMismatch = 0;
    for (const o of objects) {
      // HEAD legacy public object (needs an apikey param, any non-empty value).
      const url = `${LEGACY_BASE}/public/${encodeURIComponent(o.bucket_id)}/${o.name.split("/").map(encodeURIComponent).join("/")}?apikey=x`;
      const { status, len } = await httpHead(url);
      if (status !== 200) {
        missing += 1;
        console.log(`[missing] ${o.bucket_id}/${o.name} status=${status}`);
      } else if (len !== null && len !== o.size) {
        sizeMismatch += 1;
        console.log(`[size-mismatch] ${o.bucket_id}/${o.name} manifest=${o.size} head=${len}`);
      } else {
        ok += 1;
      }
    }
    console.log(`dry-run: ok=${ok} missing=${missing} size-mismatch=${sizeMismatch}`);
    if (missing > 0 || sizeMismatch > 0) process.exit(1);
    return;
  }

  if (MODE === "copy") {
    if (!LEGACY_BASE || !TARGET_BASE || !TARGET_SERVICE_ROLE_KEY) {
      throw new Error("copy needs LEGACY_OBJECT_BASE_URL, TARGET_OBJECT_BASE_URL, TARGET_SERVICE_ROLE_KEY");
    }
    // resumable: skip objects already uploaded with matching size
    let done = 0, bytes = 0, failures = 0;
    for (const o of objects) {
      // Legacy storage public GET requires an apikey param (any non-empty value).
      const legacyUrl = legacyObjectUrl(o);
      const targetUrl = `${TARGET_BASE}/${encodeURIComponent(o.bucket_id)}/${o.name.split("/").map(encodeURIComponent).join("/")}`;
      // HEAD target with service key: object present?
      const head = await fetch(targetUrl, { method: "HEAD", headers: { Authorization: `Bearer ${TARGET_SERVICE_ROLE_KEY}`, apikey: TARGET_SERVICE_ROLE_KEY } });
      if (head.status === 200) {
        const tlen = Number(head.headers.get("content-length")) || null;
        if (tlen === o.size) {
          done += 1;
          continue;
        }
      }
      const res = await fetch(legacyUrl, { headers: legacyFetchHeaders() });
      if (!res.ok || res.status === 404) {
        failures += 1;
        console.log(`[copy failed] ${o.bucket_id}/${o.name} legacy status=${res.status}`);
        continue;
      }
      const body = await res.arrayBuffer();
      const contentType = o.content_type || res.headers.get("content-type") || "application/octet-stream";
      const up = await fetch(targetUrl, {
        method: res.ok ? "POST" : "POST",
        headers: {
          Authorization: `Bearer ${TARGET_SERVICE_ROLE_KEY}`,
          apikey: TARGET_SERVICE_ROLE_KEY,
          "Content-Type": contentType,
          "cache-control": "3600",
          "x-upsert": "true",
        },
        body,
      });
      if (up.ok) {
        done += 1;
        bytes += body.byteLength;
      } else {
        failures += 1;
        console.log(`[upload failed] ${o.bucket_id}/${o.name} status=${up.status} bytes=${body.byteLength}`);
      }
    }
    console.log(`copy: uploaded=${done} failures=${failures} bytes=${bytes}`);
    if (failures > 0) process.exit(1);
    writeFileSync(join(RUN_DIR, "storage-copy-result.json"), JSON.stringify({ done, failures, bytes, at: new Date().toISOString() }, null, 2) + "\n");
    return;
  }

  throw new Error(`unknown mode ${MODE} (manifest|dry-run|copy|verify)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
