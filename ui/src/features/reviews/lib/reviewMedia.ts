/**
 * Guest review media (`guest_reviews.media_urls`) arrives as raw JSONB, so every
 * read normalizes it before render. Shape mirrors `_shared/guestReviewService.ts`.
 */

export type GuestReviewMediaItem = {
  url: string;
  type: 'image' | 'video';
};

/** Keeps only well-formed `{ url, type }` entries; never throws on bad JSONB. */
export function normalizeReviewMedia(raw: unknown): GuestReviewMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const items: GuestReviewMediaItem[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (entry.trim()) items.push({ url: entry.trim(), type: 'image' });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const url = (entry as { url?: unknown }).url;
    if (typeof url !== 'string' || !url.trim()) continue;
    const type = (entry as { type?: unknown }).type;
    items.push({ url: url.trim(), type: type === 'video' ? 'video' : 'image' });
  }
  return items;
}
