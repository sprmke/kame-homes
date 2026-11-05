/**
 * Shared legacy → hosted target Storage copy helpers (repairHostedBlobs, syncHostedStorageFromLegacy).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ObjectRow = {
  bucket_id: string;
  name: string;
  size: number;
  content_type: string | null;
};

export const LEGACY_BUCKETS = [
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
] as const;

export function readEnvLocal(root: string, key: string): string {
  if (process.env[key]) return process.env[key] ?? '';
  for (const file of ['supabase/.env.local', 'supabase/.env.dev.local']) {
    try {
      const line = readFileSync(join(root, file), 'utf8')
        .split('\n')
        .find((l) => l.startsWith(`${key}=`));
      if (line) return line.slice(key.length + 1).trim();
    } catch {
      /* next file */
    }
  }
  return '';
}

export function loadSyncEnv(root: string) {
  const LEGACY_BASE = (
    process.env.LEGACY_OBJECT_BASE_URL || readEnvLocal(root, 'LEGACY_OBJECT_BASE_URL')
  ).replace(/\/+$/, '');
  const LEGACY_KEY =
    process.env.LEGACY_SERVICE_ROLE_KEY || readEnvLocal(root, 'LEGACY_SERVICE_ROLE_KEY');
  const devSupabaseUrl = readEnvLocal(root, 'DEV_SUPABASE_URL').replace(/\/+$/, '');
  const TARGET_BASE = (
    process.env.TARGET_OBJECT_BASE_URL ||
    readEnvLocal(root, 'TARGET_OBJECT_BASE_URL') ||
    (devSupabaseUrl ? `${devSupabaseUrl}/storage/v1/object` : '')
  ).replace(/\/+$/, '');
  const TARGET_KEY =
    process.env.TARGET_SERVICE_ROLE_KEY ||
    readEnvLocal(root, 'TARGET_SERVICE_ROLE_KEY') ||
    readEnvLocal(root, 'DEV_SERVICE_ROLE_KEY');
  const TARGET_REST = devSupabaseUrl || TARGET_BASE.replace(/\/storage\/v1\/object\/?$/, '');
  return { LEGACY_BASE, LEGACY_KEY, TARGET_BASE, TARGET_KEY, TARGET_REST };
}

export function legacyObjectUrl(
  legacyBase: string,
  legacyKey: string,
  o: Pick<ObjectRow, 'bucket_id' | 'name'>
): string {
  const base = legacyBase.replace(/\/(public|object)\/?$/, '');
  const path = o.name.split('/').map(encodeURIComponent).join('/');
  const url = `${base}/object/${encodeURIComponent(o.bucket_id)}/${path}`;
  return legacyKey ? url : `${url}?apikey=x`;
}

export function legacyFetchHeaders(
  legacyKey: string,
  contentType?: string
): Record<string, string> {
  const h: Record<string, string> = { apikey: legacyKey || 'x' };
  if (legacyKey) h.Authorization = `Bearer ${legacyKey}`;
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

export function targetObjectUrl(
  targetBase: string,
  o: Pick<ObjectRow, 'bucket_id' | 'name'>
): string {
  const path = o.name.split('/').map(encodeURIComponent).join('/');
  return `${targetBase}/${encodeURIComponent(o.bucket_id)}/${path}`;
}

function fullyDecodePathSegment(raw: string): string {
  let path = raw;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(path);
      if (next === path) break;
      path = next;
    } catch {
      break;
    }
  }
  return path;
}

export function parseStorageKeyFromUrl(url: string): string | null {
  const m = url.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/
  );
  if (!m) return null;
  const bucket = m[1];
  const name = fullyDecodePathSegment(m[2]);
  return `${bucket}/${name}`;
}

export function rowFromKey(key: string): ObjectRow {
  const slash = key.indexOf('/');
  return {
    bucket_id: key.slice(0, slash),
    name: key.slice(slash + 1),
    size: 0,
    content_type: null,
  };
}

export async function targetBlobReadable(
  targetBase: string,
  targetKey: string,
  o: Pick<ObjectRow, 'bucket_id' | 'name'>
): Promise<boolean> {
  const targetUrl = targetObjectUrl(targetBase, o);
  try {
    const head = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${targetKey}`,
        apikey: targetKey,
      },
    });
    if (!head.ok) return false;
    const len = Number(head.headers.get('content-length')) || 0;
    return len > 0;
  } catch {
    return false;
  }
}

function objectNameCandidates(name: string): string[] {
  const out = [name];
  if (name.includes('%')) {
    try {
      const decoded = decodeURIComponent(name);
      if (decoded !== name) out.push(decoded);
    } catch {
      /* keep original */
    }
  }
  return [...new Set(out)];
}

export async function copyFromLegacyToTarget(
  env: ReturnType<typeof loadSyncEnv>,
  o: ObjectRow
): Promise<'skipped' | 'repaired' | 'legacy-missing' | 'upload-failed'> {
  if (await targetBlobReadable(env.TARGET_BASE, env.TARGET_KEY, o)) {
    return 'skipped';
  }
  const base = env.LEGACY_BASE.replace(/\/(public|object)\/?$/, '');
  const headers = legacyFetchHeaders(env.LEGACY_KEY);
  let res: Response | null = null;
  for (const name of objectNameCandidates(o.name)) {
    const row = { bucket_id: o.bucket_id, name };
    const encPath = name.split('/').map(encodeURIComponent).join('/');
    const legacyUrls = [
      legacyObjectUrl(env.LEGACY_BASE, env.LEGACY_KEY, row),
      `${base}/object/public/${encodeURIComponent(o.bucket_id)}/${encPath}?apikey=x`,
    ];
    for (const legacyUrl of legacyUrls) {
      const attempt = await fetch(legacyUrl, {
        headers: env.LEGACY_KEY ? headers : {},
      });
      if (attempt.ok) {
        res = attempt;
        break;
      }
    }
    if (res?.ok) break;
  }
  if (!res?.ok) return 'legacy-missing';

  const body = await res.arrayBuffer();
  if (body.byteLength === 0) return 'legacy-missing';

  const contentType =
    o.content_type || res.headers.get('content-type') || 'application/octet-stream';
  const up = await fetch(targetObjectUrl(env.TARGET_BASE, o), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TARGET_KEY}`,
      apikey: env.TARGET_KEY,
      'Content-Type': contentType,
      'cache-control': '3600',
      'x-upsert': 'true',
    },
    body,
  });
  return up.ok ? 'repaired' : 'upload-failed';
}

type ListRow = { name: string; id: string | null; metadata?: { size?: number; mimetype?: string } };

export async function listBucketObjects(
  apiBase: string,
  serviceKey: string,
  bucket_id: string,
  prefix = ''
): Promise<ObjectRow[]> {
  const out: ObjectRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${apiBase}/object/list/${encodeURIComponent(bucket_id)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix,
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!res.ok) break;
    const page = (await res.json()) as ListRow[];
    if (!page.length) break;
    for (const row of page) {
      const fullName = prefix ? `${prefix}/${row.name}` : row.name;
      if (row.id === null) {
        const nested = await listBucketObjects(apiBase, serviceKey, bucket_id, fullName);
        out.push(...nested);
      } else {
        out.push({
          bucket_id,
          name: fullName,
          size: Number(row.metadata?.size ?? 0),
          content_type: row.metadata?.mimetype ?? null,
        });
      }
    }
    if (page.length < 1000) break;
    offset += page.length;
  }
  return out;
}

export const BOOKING_ASSET_URL_COLUMNS = [
  'valid_id_url',
  'guest2_valid_id_url',
  'guest3_valid_id_url',
  'guest4_valid_id_url',
  'guest5_valid_id_url',
  'payment_receipt_url',
  'parking_endorsement_url',
  'parking_payment_receipt_url',
  'approved_gaf_pdf_url',
  'approved_pet_pdf_url',
  'sd_refund_receipt_url',
  'guest_balance_payment_receipt_url',
  'pet_vaccination_url',
  'pet_image_url',
] as const;

export async function fetchBookingStorageKeys(
  targetRest: string,
  targetKey: string
): Promise<string[]> {
  const select = ['id', ...BOOKING_ASSET_URL_COLUMNS].join(',');
  const res = await fetch(`${targetRest}/rest/v1/guest_submissions?select=${select}`, {
    headers: { Authorization: `Bearer ${targetKey}`, apikey: targetKey },
  });
  if (!res.ok) throw new Error(`guest_submissions fetch failed: ${res.status}`);
  const rows = (await res.json()) as Record<string, string | null>[];
  const keys = new Set<string>();
  for (const row of rows) {
    for (const col of BOOKING_ASSET_URL_COLUMNS) {
      const url = row[col];
      if (!url || typeof url !== 'string' || url.trim() === '' || url === 'dev-mode-skipped') {
        continue;
      }
      const key = parseStorageKeyFromUrl(url);
      if (key) keys.add(key);
    }
  }
  return [...keys].sort();
}
