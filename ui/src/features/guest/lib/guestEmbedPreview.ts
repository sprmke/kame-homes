/** Query flag for dashboard Public Pages iframe thumbnails (`?embed=1`). */

export const GUEST_EMBED_PREVIEW_QUERY = 'embed';

export function isGuestEmbedPreview(searchParams: URLSearchParams): boolean {
  return searchParams.get(GUEST_EMBED_PREVIEW_QUERY) === '1';
}

/** Append embed flag for iframe previews — not for shareable guest links. */
export function withGuestEmbedPreviewUrl(url: string): string {
  if (typeof window === 'undefined') {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${GUEST_EMBED_PREVIEW_QUERY}=1`;
  }

  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.set(GUEST_EMBED_PREVIEW_QUERY, '1');
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
