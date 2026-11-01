/**
 * Repair fwor (hosted) Storage blobs when Postgres metadata exists but S3 returns NoSuchKey.
 * Fetches each object from legacy Storage and upserts to the target project.
 *
 * Env (gitignored supabase/.env.local + .env.dev.local):
 *   LEGACY_OBJECT_BASE_URL, LEGACY_SERVICE_ROLE_KEY
 *   TARGET_OBJECT_BASE_URL=https://<ref>.supabase.co/storage/v1/object
 *   TARGET_SERVICE_ROLE_KEY
 *
 * Usage:
 *   bun scripts/migrate/legacy-to-mt-prod/storage/repairHostedBlobs.ts dry-run [limit]
 *   bun scripts/migrate/legacy-to-mt-prod/storage/repairHostedBlobs.ts copy [limit]
 *
 * Manifest: RUN_DIR/storage-manifest.json or backups/migration/latest-rehearsal/storage-manifest.json
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..', '..');
const RUN_DIR = process.env.RUN_DIR || join(ROOT, 'backups', 'migration', 'latest-rehearsal');
const MODE = process.argv[2] ?? 'dry-run';
const LIMIT = Number(process.argv[3] ?? 0);

type ObjectRow = {
  bucket_id: string;
  name: string;
  size: number;
  content_type: string | null;
};

function readEnvLocal(key: string): string {
  if (process.env[key]) return process.env[key] ?? '';
  for (const file of ['supabase/.env.local', 'supabase/.env.dev.local']) {
    try {
      const line = readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .find((l) => l.startsWith(`${key}=`));
      if (line) return line.slice(key.length + 1).trim();
    } catch {
      /* next file */
    }
  }
  return '';
}

const LEGACY_BASE = (
  process.env.LEGACY_OBJECT_BASE_URL || readEnvLocal('LEGACY_OBJECT_BASE_URL')
).replace(/\/+$/, '');
const LEGACY_KEY = process.env.LEGACY_SERVICE_ROLE_KEY || readEnvLocal('LEGACY_SERVICE_ROLE_KEY');
const devSupabaseUrl = readEnvLocal('DEV_SUPABASE_URL').replace(/\/+$/, '');
const TARGET_BASE = (
  process.env.TARGET_OBJECT_BASE_URL ||
  readEnvLocal('TARGET_OBJECT_BASE_URL') ||
  (devSupabaseUrl ? `${devSupabaseUrl}/storage/v1/object` : '')
).replace(/\/+$/, '');
const TARGET_KEY =
  process.env.TARGET_SERVICE_ROLE_KEY ||
  readEnvLocal('TARGET_SERVICE_ROLE_KEY') ||
  readEnvLocal('DEV_SERVICE_ROLE_KEY');

function legacyObjectUrl(o: ObjectRow): string {
  const base = LEGACY_BASE.replace(/\/(public|object)\/?$/, '');
  const path = o.name.split('/').map(encodeURIComponent).join('/');
  if (LEGACY_KEY) {
    return `${base}/object/${encodeURIComponent(o.bucket_id)}/${path}`;
  }
  return `${base}/object/public/${encodeURIComponent(o.bucket_id)}/${path}?apikey=x`;
}

function targetObjectUrl(o: ObjectRow): string {
  const path = o.name.split('/').map(encodeURIComponent).join('/');
  return `${TARGET_BASE}/${encodeURIComponent(o.bucket_id)}/${path}`;
}

async function targetBlobReadable(o: ObjectRow): Promise<boolean> {
  const signUrl = `${TARGET_BASE.replace(/\/object\/?$/, '')}/object/sign/${encodeURIComponent(o.bucket_id)}/${o.name.split('/').map(encodeURIComponent).join('/')}`;
  const signRes = await fetch(signUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TARGET_KEY}`,
      apikey: TARGET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: 120 }),
  });
  if (!signRes.ok) return false;
  const { signedURL } = (await signRes.json()) as { signedURL?: string };
  if (!signedURL) return false;
  const host = TARGET_BASE.match(/^https?:\/\/[^/]+/)?.[0] ?? '';
  const full = `${host}/storage/v1${signedURL}`;
  const head = await fetch(full, { method: 'HEAD' });
  return head.ok;
}

const LEGACY_BUCKETS = [
  'payment-receipts',
  'valid-ids',
  'templates',
  'pet-vaccinations',
  'pet-images',
  'parking-endorsements',
  'approved-gafs',
  'approved-pet-forms',
  'sd-refund-receipts',
  'app-settings-assets',
];

async function manifestFromTargetListing(): Promise<ObjectRow[]> {
  const apiBase = TARGET_BASE.replace(/\/storage\/v1\/object\/?$/, '/storage/v1');
  const out: ObjectRow[] = [];
  for (const bucket_id of LEGACY_BUCKETS) {
    let offset = 0;
    for (;;) {
      const res = await fetch(`${apiBase}/object/list/${encodeURIComponent(bucket_id)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TARGET_KEY}`,
          apikey: TARGET_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: '', limit: 1000, offset }),
      });
      if (!res.ok) break;
      const page = (await res.json()) as {
        name: string;
        metadata?: { size?: number; mimetype?: string };
      }[];
      if (!page.length) break;
      for (const row of page) {
        out.push({
          bucket_id,
          name: row.name,
          size: Number(row.metadata?.size ?? 0),
          content_type: row.metadata?.mimetype ?? null,
        });
      }
      if (page.length < 1000) break;
      offset += page.length;
    }
  }
  return out;
}

function loadManifest(): ObjectRow[] {
  const path = join(RUN_DIR, 'storage-manifest.json');
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8')) as ObjectRow[];
}

async function main() {
  if (!LEGACY_BASE || !TARGET_BASE || !TARGET_KEY) {
    throw new Error('Need LEGACY_OBJECT_BASE_URL, TARGET_OBJECT_BASE_URL, TARGET_SERVICE_ROLE_KEY');
  }
  let objects = loadManifest();
  if (objects.length === 0) {
    console.log('Building manifest from target Storage listing (metadata rows)');
    objects = await manifestFromTargetListing();
    const manifestPath = join(RUN_DIR, 'storage-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(objects, null, 2) + '\n');
    console.log(`Wrote ${objects.length} rows to ${manifestPath}`);
  }
  const scan = LIMIT > 0 ? objects.slice(0, LIMIT) : objects;

  let ok = 0;
  let missing = 0;
  let repaired = 0;
  let failed = 0;

  for (const o of scan) {
    const readable = await targetBlobReadable(o);
    if (readable) {
      ok += 1;
      continue;
    }
    missing += 1;
    if (MODE === 'dry-run') {
      console.log(`[ghost] ${o.bucket_id}/${o.name} size=${o.size}`);
      continue;
    }

    const base = LEGACY_BASE.replace(/\/(public|object)\/?$/, '');
    const encPath = o.name.split('/').map(encodeURIComponent).join('/');
    const legacyUrls = [
      legacyObjectUrl(o),
      `${base}/object/public/${encodeURIComponent(o.bucket_id)}/${encPath}?apikey=x`,
    ];
    const headers: Record<string, string> = { apikey: LEGACY_KEY || 'x' };
    if (LEGACY_KEY) headers.Authorization = `Bearer ${LEGACY_KEY}`;
    let res: Response | null = null;
    for (const legacyUrl of legacyUrls) {
      const attempt = await fetch(legacyUrl, { headers: LEGACY_KEY ? headers : {} });
      if (attempt.ok) {
        res = attempt;
        break;
      }
    }
    if (!res?.ok) {
      failed += 1;
      console.log(`[legacy-missing] ${o.bucket_id}/${o.name} status=${res?.status ?? 0}`);
      continue;
    }
    const body = await res.arrayBuffer();
    const contentType =
      o.content_type || res.headers.get('content-type') || 'application/octet-stream';
    const up = await fetch(targetObjectUrl(o), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TARGET_KEY}`,
        apikey: TARGET_KEY,
        'Content-Type': contentType,
        'cache-control': '3600',
        'x-upsert': 'true',
      },
      body,
    });
    if (up.ok) {
      repaired += 1;
    } else {
      failed += 1;
      console.log(`[upload-failed] ${o.bucket_id}/${o.name} status=${up.status}`);
    }
  }

  const summary = { mode: MODE, scanned: scan.length, ok, missing, repaired, failed };
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync(
    join(RUN_DIR, 'storage-repair-result.json'),
    JSON.stringify({ ...summary, at: new Date().toISOString() }, null, 2) + '\n'
  );
  if (failed > 0 || (MODE === 'dry-run' && missing > 0 && process.env.FAIL_ON_GHOST === '1')) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
