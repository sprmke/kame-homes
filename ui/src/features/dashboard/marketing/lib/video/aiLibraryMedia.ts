import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type { MarketingMediaAsset } from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';

/** Uploads the AI builder may use as clips: recent photos first, a couple of short videos. */
export const AI_LIBRARY_MAX_IMAGES = 6;
const AI_LIBRARY_MAX_VIDEOS = 2;
/** Longer uploads make poor scene backgrounds (a scene is 1 to 12 s). */
const AI_LIBRARY_MAX_VIDEO_MS = 20_000;

export type LibraryClip = { url: string; type: 'image' | 'video' };

/** Pick builder-friendly clips from library assets, newest first, capped per kind. */
export function libraryClipsForAi(assets: readonly MarketingMediaAsset[]): LibraryClip[] {
  const sorted = assets
    .filter((asset) => asset.kind !== 'audio' && /^https?:\/\//i.test(asset.url))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out: LibraryClip[] = [];
  let images = 0;
  let videos = 0;
  for (const asset of sorted) {
    if (asset.kind === 'image' && images < AI_LIBRARY_MAX_IMAGES) {
      out.push({ url: asset.url, type: 'image' });
      images += 1;
    } else if (
      asset.kind === 'video' &&
      videos < AI_LIBRARY_MAX_VIDEOS &&
      (asset.durationMs ?? 0) <= AI_LIBRARY_MAX_VIDEO_MS
    ) {
      out.push({ url: asset.url, type: 'video' });
      videos += 1;
    }
  }
  return out;
}

/**
 * The binding the AI builder draws scene media from, with the host's uploads in front of the
 * property gallery so their own footage is what the first scenes show. Gallery items follow.
 */
export function bindingWithLibraryClips(
  binding: DesignBinding,
  clips: readonly LibraryClip[]
): DesignBinding {
  if (clips.length === 0) return binding;
  const seen = new Set<string>();
  const merged = [...clips, ...(binding.propertyMedia ?? [])].filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  const firstImage = merged.find((item) => item.type === 'image');
  return {
    ...binding,
    propertyMedia: merged,
    propertyPhoto: binding.propertyPhoto ?? firstImage?.url ?? null,
  };
}
