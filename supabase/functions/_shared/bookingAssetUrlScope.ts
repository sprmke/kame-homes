import { BOOKING_ASSET_CONFIG } from './bookingAssetTypes.ts';
import { parseStorageObjectUrl } from './storageSignedUrl.ts';
import { formatPublicUrl } from './utils.ts';

/**
 * Orchestrator-generated request PDFs live in private buckets but are not
 * uploadable via `upload-booking-asset`, so they are absent from
 * BOOKING_ASSET_CONFIG. Still include them so `get-booking-asset-url` can mint
 * signed URLs for View on booking detail.
 */
const REQUEST_PDF_URL_COLUMNS = ['gaf_request_pdf_url', 'pet_request_pdf_url'] as const;

const ASSET_URL_COLUMNS = [
  ...new Set([
    ...Object.values(BOOKING_ASSET_CONFIG).map((entry) => entry.column),
    ...REQUEST_PDF_URL_COLUMNS,
  ]),
];

export function bookingAssetUrlColumnList(): string {
  return ASSET_URL_COLUMNS.join(', ');
}

import { fullyDecodeStorageObjectPath } from './storageSignedUrl.ts';

function normalizePath(path: string): string {
  return fullyDecodeStorageObjectPath(path);
}

/** True when a stored URL points at the same private object (bucket + object path). */
export function storedUrlReferencesStorageObject(
  storedUrl: string,
  target: { bucket: string; path: string }
): boolean {
  const trimmed = storedUrl.trim();
  if (!trimmed) return false;

  const parsed = parseStorageObjectUrl(formatPublicUrl(trimmed));
  if (!parsed || parsed.bucket !== target.bucket) return false;

  const storedPath = normalizePath(parsed.path);
  const wantedPath = normalizePath(target.path);
  if (storedPath === wantedPath) return true;

  const storedBase = storedPath.split('/').pop();
  const wantedBase = wantedPath.split('/').pop();
  return Boolean(storedBase && wantedBase && storedBase === wantedBase);
}

export function bookingRowReferencesStorageObject(
  row: Record<string, unknown>,
  target: { bucket: string; path: string }
): boolean {
  return resolveMatchingStorageLocFromBookingRow(row, target) != null;
}

/** Path from the booking column that matched (authoritative for signing). */
export function resolveMatchingStorageLocFromBookingRow(
  row: Record<string, unknown>,
  target: { bucket: string; path: string }
): { bucket: string; path: string } | null {
  for (const column of ASSET_URL_COLUMNS) {
    const value = row[column];
    if (typeof value !== 'string') continue;
    if (!storedUrlReferencesStorageObject(value, target)) continue;
    const parsed = parseStorageObjectUrl(formatPublicUrl(value.trim()));
    if (parsed && parsed.bucket === target.bucket) return parsed;
  }
  return null;
}

export function buildStoragePathCandidates(
  primaryPath: string,
  ctx: { propertyId: string; bookingId?: string }
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const n = normalizePath(p.replace(/^\/+/, ''));
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  push(primaryPath);
  const base = primaryPath.split('/').filter(Boolean).pop();
  if (!base) return out;

  push(base);
  const pid = ctx.propertyId.trim();
  if (pid) {
    push(`${pid}/${base}`);
    const bid = ctx.bookingId?.trim();
    if (bid) push(`${pid}/${bid}/${base}`);
  }
  return out;
}
