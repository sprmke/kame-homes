/**
 * Private Supabase Storage buckets and signed-URL helpers.
 * Guest PII buckets (Phase 2) and admin-only buckets share the same signing path.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import type { GuestFormData } from './types.ts';
import { formatPublicUrl } from './utils.ts';

export const GUEST_DOC_STORAGE_BUCKETS = new Set([
  'payment-receipts',
  'valid-ids',
  'pet-vaccinations',
  'pet-images',
  'parking-endorsements',
]);

export const ADMIN_ONLY_PRIVATE_STORAGE_BUCKETS = new Set([
  'approved-gafs',
  'approved-pet-forms',
  'sd-refund-receipts',
]);

export const PRIVATE_STORAGE_BUCKETS = new Set([
  ...ADMIN_ONLY_PRIVATE_STORAGE_BUCKETS,
  ...GUEST_DOC_STORAGE_BUCKETS,
]);

export const STORAGE_OBJECT_PATH_RE = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/;

export const DEFAULT_SIGNED_URL_TTL_SEC = 60 * 30;

const GUEST_FORM_STORAGE_URL_FIELDS: (keyof GuestFormData)[] = [
  'paymentReceiptUrl',
  'validIdUrl',
  'guest2ValidIdUrl',
  'guest3ValidIdUrl',
  'guest4ValidIdUrl',
  'guest5ValidIdUrl',
  'petVaccinationUrl',
  'petImageUrl',
];

export function parseStorageObjectUrl(url: string): { bucket: string; path: string } | null {
  const withoutQuery = url.split('?')[0] ?? '';
  const match = withoutQuery.match(STORAGE_OBJECT_PATH_RE);
  if (!match) return null;
  const bucket = match[1];
  const rawPath = match[2] ?? '';
  if (!bucket || !rawPath) return null;
  try {
    return { bucket, path: decodeURIComponent(rawPath) };
  } catch {
    return { bucket, path: rawPath };
  }
}

export function isPrivateStorageBucket(bucket: string): boolean {
  return PRIVATE_STORAGE_BUCKETS.has(bucket);
}

/**
 * Returns a short-lived signed URL for objects in private buckets; otherwise the normalized URL.
 */
export async function createSignedStorageUrlIfPrivate(
  supabase: SupabaseClient,
  url: string,
  ttlSec = DEFAULT_SIGNED_URL_TTL_SEC
): Promise<string> {
  const trimmed = url?.trim();
  if (!trimmed) return url;

  const normalized = formatPublicUrl(trimmed);
  const loc = parseStorageObjectUrl(normalized);
  if (!loc || !isPrivateStorageBucket(loc.bucket)) {
    return normalized;
  }

  const { data, error } = await supabase.storage.from(loc.bucket).createSignedUrl(loc.path, ttlSec);

  if (error || !data?.signedUrl) {
    console.warn(
      `[storageSignedUrl] Failed to sign ${loc.bucket}/${loc.path}:`,
      error?.message ?? 'no signedUrl'
    );
    return normalized;
  }

  return formatPublicUrl(data.signedUrl);
}

export async function signGuestFormDataStorageUrls(
  formData: GuestFormData,
  supabase: SupabaseClient
): Promise<GuestFormData> {
  const out: GuestFormData = { ...formData };

  await Promise.all(
    GUEST_FORM_STORAGE_URL_FIELDS.map(async (field) => {
      const value = out[field];
      if (typeof value === 'string' && value.trim()) {
        (out as unknown as Record<string, string>)[field] = await createSignedStorageUrlIfPrivate(
          supabase,
          value
        );
      }
    })
  );

  return out;
}
