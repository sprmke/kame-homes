/**
 * Property gallery media — validation shared by upload + update-property.
 */

import { UPLOAD_MAX_BYTES } from './uploadLimits.ts';

export const PROPERTY_MEDIA_BUCKET = 'property-media';

export const MAX_PROPERTY_IMAGES = 9;
export const MAX_PROPERTY_VIDEOS = 1;

/**
 * Unified upload ceilings (see `_shared/uploadLimits.ts`). Images are shrunk
 * client-side well below this; the ceiling only catches bypass / pass-through.
 */
export const MAX_PROPERTY_IMAGE_BYTES = UPLOAD_MAX_BYTES.image; // 10 MB
export const MAX_PROPERTY_VIDEO_BYTES = UPLOAD_MAX_BYTES.video; // 50 MB

export const ALLOWED_PROPERTY_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  'image/avif',
]);

export const ALLOWED_PROPERTY_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/ogg',
  'video/mpeg',
]);

export type PropertyMediaType = 'image' | 'video';

export type PropertyMediaRecord = {
  id: string;
  url: string;
  storagePath?: string;
  type: PropertyMediaType;
  caption?: string;
  isPrimary?: boolean;
  order: number;
};

export function classifyPropertyMediaMime(mime: string): PropertyMediaType | null {
  const normalized = mime.trim().toLowerCase();
  if (normalized === 'image/svg+xml') return null;
  if (ALLOWED_PROPERTY_IMAGE_MIME.has(normalized)) return 'image';
  if (ALLOWED_PROPERTY_VIDEO_MIME.has(normalized)) return 'video';
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  return null;
}

export function maxBytesForPropertyMediaType(type: PropertyMediaType): number {
  return type === 'video' ? MAX_PROPERTY_VIDEO_BYTES : MAX_PROPERTY_IMAGE_BYTES;
}

export function countPropertyMediaByType(items: PropertyMediaRecord[]): {
  images: number;
  videos: number;
} {
  let images = 0;
  let videos = 0;
  for (const item of items) {
    if (item.type === 'video') videos += 1;
    else images += 1;
  }
  return { images, videos };
}

export function normalizePropertyMediaItems(raw: unknown): PropertyMediaRecord[] {
  if (!Array.isArray(raw)) return [];

  const parsed: PropertyMediaRecord[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!id || !url) continue;

    const type: PropertyMediaType = row.type === 'video' ? 'video' : 'image';
    const order =
      typeof row.order === 'number' && Number.isFinite(row.order)
        ? Math.max(0, Math.round(row.order))
        : parsed.length;
    const caption = typeof row.caption === 'string' ? row.caption.trim().slice(0, 120) : undefined;
    const storagePath = typeof row.storagePath === 'string' ? row.storagePath.trim() : undefined;

    parsed.push({
      id,
      url,
      storagePath: storagePath || undefined,
      type,
      caption: caption || undefined,
      isPrimary: row.isPrimary === true,
      order,
    });
  }

  parsed.sort((a, b) => a.order - b.order);

  const images = parsed.filter((item) => item.type === 'image');
  const videos = parsed.filter((item) => item.type === 'video').slice(0, MAX_PROPERTY_VIDEOS);
  const combined = [...images, ...videos];

  const hasPrimaryImage = images.some((item) => item.isPrimary);
  const primaryId = hasPrimaryImage ? images.find((item) => item.isPrimary)?.id : images[0]?.id;

  return combined.map((item, index) => ({
    ...item,
    order: index,
    isPrimary: item.type === 'image' ? item.id === primaryId : false,
  }));
}

export function validatePropertyMediaArray(
  raw: unknown
): { ok: true; items: PropertyMediaRecord[] } | { ok: false; error: string } {
  const items = normalizePropertyMediaItems(raw);
  const { images, videos } = countPropertyMediaByType(items);

  if (images > MAX_PROPERTY_IMAGES) {
    return {
      ok: false,
      error: `At most ${MAX_PROPERTY_IMAGES} images are allowed`,
    };
  }
  if (videos > MAX_PROPERTY_VIDEOS) {
    return {
      ok: false,
      error: `At most ${MAX_PROPERTY_VIDEOS} video is allowed`,
    };
  }

  const primaryImages = items.filter((item) => item.type === 'image' && item.isPrimary);
  if (primaryImages.length > 1) {
    return { ok: false, error: 'Only one primary image is allowed' };
  }

  for (const item of items) {
    if (!item.url.startsWith('http://') && !item.url.startsWith('https://')) {
      return { ok: false, error: 'Media URLs must be absolute http(s) URLs' };
    }
    if (item.type === 'video' && item.isPrimary) {
      return { ok: false, error: 'Videos cannot be set as primary' };
    }
  }

  return { ok: true, items };
}

export function propertyMediaStoragePath(propertyId: string, mediaId: string, ext: string): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  return `${propertyId}/${mediaId}${safeExt}`;
}

export function developmentMediaStoragePath(
  developmentId: string,
  mediaId: string,
  ext: string
): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  return `developments/${developmentId}/${mediaId}${safeExt}`;
}
