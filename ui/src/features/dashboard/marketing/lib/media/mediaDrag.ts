/**
 * Drag payload for library media dropped on the timeline or canvas. Uses a custom MIME type so
 * unrelated drags (files, text) are ignored, and carries only what a drop needs.
 */

import type { MarketingMediaAsset } from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';

export const MARKETING_MEDIA_DRAG_TYPE = 'application/x-kame-marketing-media';

export type MediaDragPayload = {
  kind: 'image' | 'video' | 'audio';
  url: string;
  assetId: string | null;
  source: 'library' | 'property' | 'jamendo';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  posterUrl: string | null;
  title?: string;
  /** Free-music tracks only: Jamendo id and credit, kept on the audio clip. */
  trackId?: string;
  artist?: string;
};

export function payloadFromAsset(asset: MarketingMediaAsset): MediaDragPayload {
  return {
    kind: asset.kind,
    url: asset.url,
    assetId: asset.id,
    source: 'library',
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    posterUrl: asset.posterUrl,
    title: asset.fileName,
  };
}

export function writeMediaDrag(dataTransfer: DataTransfer, payload: MediaDragPayload): void {
  dataTransfer.setData(MARKETING_MEDIA_DRAG_TYPE, JSON.stringify(payload));
  dataTransfer.effectAllowed = 'copy';
}

export function hasMediaDrag(dataTransfer: Pick<DataTransfer, 'types'> | null): boolean {
  return Boolean(
    dataTransfer && Array.from(dataTransfer.types).includes(MARKETING_MEDIA_DRAG_TYPE)
  );
}

/** Parse a drop. Returns null for foreign or malformed data; never throws. */
export function readMediaDrag(
  dataTransfer: Pick<DataTransfer, 'getData'> | null
): MediaDragPayload | null {
  if (!dataTransfer) return null;
  try {
    const raw = dataTransfer.getData(MARKETING_MEDIA_DRAG_TYPE);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MediaDragPayload>;
    if (
      (value.kind !== 'image' && value.kind !== 'video' && value.kind !== 'audio') ||
      typeof value.url !== 'string' ||
      !/^https?:\/\//i.test(value.url)
    ) {
      return null;
    }
    return {
      kind: value.kind,
      url: value.url,
      assetId: typeof value.assetId === 'string' ? value.assetId : null,
      source: value.source === 'property' || value.source === 'jamendo' ? value.source : 'library',
      width: typeof value.width === 'number' ? value.width : null,
      height: typeof value.height === 'number' ? value.height : null,
      durationMs: typeof value.durationMs === 'number' ? value.durationMs : null,
      posterUrl: typeof value.posterUrl === 'string' ? value.posterUrl : null,
      title: typeof value.title === 'string' ? value.title.slice(0, 200) : undefined,
      trackId: typeof value.trackId === 'string' ? value.trackId.slice(0, 64) : undefined,
      artist: typeof value.artist === 'string' ? value.artist.slice(0, 200) : undefined,
    };
  } catch {
    return null;
  }
}
