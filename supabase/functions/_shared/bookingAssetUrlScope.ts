import { BOOKING_ASSET_CONFIG } from './bookingAssetTypes.ts';
import { parseStorageObjectUrl } from './storageSignedUrl.ts';
import { formatPublicUrl } from './utils.ts';

const ASSET_URL_COLUMNS = [
  ...new Set(Object.values(BOOKING_ASSET_CONFIG).map((entry) => entry.column)),
];

export function bookingAssetUrlColumnList(): string {
  return ASSET_URL_COLUMNS.join(', ');
}

function normalizePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
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
  for (const column of ASSET_URL_COLUMNS) {
    const value = row[column];
    if (typeof value !== 'string') continue;
    if (storedUrlReferencesStorageObject(value, target)) return true;
  }
  return false;
}
