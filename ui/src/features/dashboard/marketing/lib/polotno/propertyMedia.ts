export type PropertyMediaItem = {
  url: string;
  preview: string;
  type: 'image' | 'video';
};

export function propertyMediaItems(imageUrls: string[]): PropertyMediaItem[] {
  const unique = [...new Set(imageUrls.filter(Boolean))];
  return unique.map((url) => ({ url, preview: url, type: 'image' as const }));
}

export function propertyGalleryMediaItems(
  media: Array<{ url: string; type: 'image' | 'video' }>
): PropertyMediaItem[] {
  const seen = new Set<string>();
  const items: PropertyMediaItem[] = [];
  for (const item of media) {
    if (!item.url.trim() || seen.has(item.url)) continue;
    seen.add(item.url);
    items.push({ url: item.url, preview: item.url, type: item.type });
  }
  return items;
}

/** Pick a random image URL from a list. Returns null if no images are available.
 *  Used when generating AI marketing variations so each format/call can use a
 *  different property photo instead of always defaulting to the cover image. */
export function pickRandomPropertyPhoto(imageUrls: string[] | undefined | null): string | null {
  const unique = [...new Set((imageUrls ?? []).filter(Boolean))];
  if (unique.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * unique.length);
  return unique[randomIndex] ?? null;
}
