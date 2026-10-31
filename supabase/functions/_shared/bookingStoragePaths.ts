/**
 * Supabase Storage keys for booking-scoped assets.
 * New uploads: `{propertyId}/{bookingId}/{fileName}` when propertyId is set.
 * Legacy rows may still point at `{bookingId}/{fileName}` or flat guest-form keys.
 */

export function bookingAssetStorageKey(
  propertyId: string | null | undefined,
  bookingId: string,
  fileName: string
): string {
  const cleanName = fileName.replace(/^\/+/, '');
  const bookingSegment = cleanName.includes('/') ? cleanName : `${bookingId}/${cleanName}`;
  const pid = propertyId?.trim();
  return pid ? `${pid}/${bookingSegment}` : bookingSegment;
}

export function prefixPropertyStorageKey(
  propertyId: string | null | undefined,
  storageKey: string
): string {
  const key = storageKey.replace(/^\/+/, '');
  const pid = propertyId?.trim();
  if (!pid) return key;
  if (key.startsWith(`${pid}/`)) return key;
  return `${pid}/${key}`;
}
