import { supabase } from '@/lib/supabase/client';

function deriveProjectBaseUrl(): string | null {
  const explicit = import.meta.env.VITE_SUPABASE_PROJECT_URL as string | undefined;
  if (explicit?.trim()) return explicit.replace(/\/+$/, '');

  const functionsUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!functionsUrl?.trim()) return null;
  return functionsUrl.replace(/\/+$/, '').replace(/\/functions\/v1$/, '');
}

const PUBLIC_SUPABASE_BASE_URL = deriveProjectBaseUrl();
const STORAGE_OBJECT_PATH_RE = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/;

export const PRIVATE_STORAGE_BUCKETS = new Set([
  'approved-gafs',
  'approved-pet-forms',
  'sd-refund-receipts',
  'payment-receipts',
  'valid-ids',
  'pet-vaccinations',
  'pet-images',
  'parking-endorsements',
]);

export function normalizeStoragePublicUrl(
  url: string | null | undefined
): string | null | undefined {
  if (!url) return url;
  if (!PUBLIC_SUPABASE_BASE_URL) return url;

  let normalized = url
    .replace(/^http:\/\/kong:8000/, PUBLIC_SUPABASE_BASE_URL)
    .replace(/^http:\/\/supabase_kong_[^/]+:8000/, PUBLIC_SUPABASE_BASE_URL);

  normalized = normalized.replace(
    /^https?:\/\/[^/]+\/functions\/v1\/storage\/v1\//,
    `${PUBLIC_SUPABASE_BASE_URL}/storage/v1/`
  );

  return normalized;
}

/**
 * Append a cache-bust query param so replaced storage objects (same public URL)
 * reload in `<img>` previews after upsert uploads.
 */
export function withStorageUrlCacheBust(
  url: string,
  version: number | string | null | undefined
): string {
  const trimmed = url?.trim();
  if (!trimmed || version == null || version === '') return url;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${encodeURIComponent(String(version))}`;
}

export function parseStorageUrl(
  url: string | null | undefined
): { bucket: string; path: string } | null {
  if (!url) return null;
  const normalized = normalizeStoragePublicUrl(url) ?? url;
  const match = normalized.match(STORAGE_OBJECT_PATH_RE);
  if (!match) return null;
  const bucket = match[1];
  const rawPath = match[2]?.split('?')[0] ?? '';
  if (!bucket || !rawPath) return null;
  return { bucket, path: decodeURIComponent(rawPath) };
}

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

class StorageObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'StorageObjectNotFoundError';
  }
}

export function isStorageObjectNotFoundError(err: unknown): err is StorageObjectNotFoundError {
  return err instanceof StorageObjectNotFoundError;
}

/**
 * Returns a URL the browser can load in `<img>` / a new tab.
 * Public-bucket URLs are returned unchanged; private buckets get a short-lived
 * signed URL via the `get-booking-asset-url` edge function.
 */
export async function resolveAssetUrlForBrowser(url: string): Promise<string> {
  const normalized = normalizeStoragePublicUrl(url) ?? url;
  const loc = parseStorageUrl(normalized);
  if (!loc || !PRIVATE_STORAGE_BUCKETS.has(loc.bucket)) return normalized;

  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('No active admin session');

  const res = await fetch(`${FUNCTIONS_URL}/get-booking-asset-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ url: normalized }),
  });
  const json = await res.json();
  if (res.status === 404 || json.code === 'STORAGE_OBJECT_NOT_FOUND') {
    throw new StorageObjectNotFoundError();
  }
  if (!res.ok || !json.success || !json.data?.url) {
    throw new Error(json.error ?? 'Failed to resolve asset URL');
  }
  return json.data.url as string;
}
