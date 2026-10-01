import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

/**
 * Listing photos become generation references by uploading a copy into the
 * reference library. The copy's file name carries a stable hash of the source URL,
 * so picking the same listing photo again reuses the earlier copy instead of
 * uploading a duplicate, and the Uploads tab can hide these copies.
 */
const LISTING_PREFIX = 'listing-';

function hashUrl(url: string): string {
  let hash = 5381;
  for (let index = 0; index < url.length; index += 1) {
    hash = ((hash << 5) + hash + url.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function listingPhotoFileStem(url: string): string {
  return `${LISTING_PREFIX}${hashUrl(url)}`;
}

export function listingPhotoFileName(url: string, mimeType: string): string {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  return `${listingPhotoFileStem(url)}.${ext}`;
}

/** The optimizer may change the extension, so match on the stem only. */
export function findListingPhotoReference(
  library: MarketingGenerationReference[],
  url: string
): MarketingGenerationReference | null {
  const stem = `${listingPhotoFileStem(url)}.`;
  return library.find((row) => row.file_name?.startsWith(stem)) ?? null;
}

export function isListingPhotoReference(reference: MarketingGenerationReference): boolean {
  return /^listing-[0-9a-f]{8}\./.test(reference.file_name ?? '');
}
