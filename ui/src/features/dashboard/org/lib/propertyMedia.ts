/**
 * Property gallery media — client validation (keep limits in sync with edge _shared/propertyMedia.ts).
 */

import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';

import { UPLOAD_MAX_BYTES } from '@/lib/media/uploadLimits';

export const MAX_PROPERTY_IMAGES = 9;
export const MAX_PROPERTY_VIDEOS = 1;

// Unified ceilings — images are compressed client-side well below this.
export const MAX_PROPERTY_IMAGE_BYTES = UPLOAD_MAX_BYTES.image;
export const MAX_PROPERTY_VIDEO_BYTES = UPLOAD_MAX_BYTES.video;

export const ACCEPT_PROPERTY_IMAGE_INPUT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/bmp,image/tiff,image/avif';

export const ACCEPT_PROPERTY_VIDEO_INPUT =
  'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/ogg,video/mpeg';

export type PropertyMediaUploadKind = 'image' | 'video';

export function classifyPropertyMediaFile(file: File): PropertyMediaUploadKind | null {
  const mime = (file.type || '').trim().toLowerCase();
  if (mime === 'image/svg+xml') return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  const name = file.name.toLowerCase();
  if (name.endsWith('.svg')) return null;
  if (/\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?|avif)$/.test(name)) {
    return 'image';
  }
  if (/\.(mp4|webm|mov|avi|mkv|ogv|mpeg|mpg)$/.test(name)) return 'video';
  return null;
}

export function maxBytesForPropertyMediaKind(kind: PropertyMediaUploadKind): number {
  return kind === 'video' ? MAX_PROPERTY_VIDEO_BYTES : MAX_PROPERTY_IMAGE_BYTES;
}

export function formatPropertyMediaSizeLimit(kind: PropertyMediaUploadKind): string {
  const mb = maxBytesForPropertyMediaKind(kind) / (1024 * 1024);
  return `${mb}MB`;
}

export function validatePropertyMediaFile(
  file: File,
  kind: PropertyMediaUploadKind,
  currentImageCount: number,
  currentVideoCount: number
): string | null {
  const detected = classifyPropertyMediaFile(file);
  if (!detected) {
    return 'Unsupported file type';
  }
  if (detected !== kind) {
    return kind === 'image' ? 'Please choose an image file' : 'Please choose a video file';
  }

  const maxBytes = maxBytesForPropertyMediaKind(kind);
  if (file.size > maxBytes) {
    return `File must be ${formatPropertyMediaSizeLimit(kind)} or smaller`;
  }

  if (kind === 'image' && currentImageCount >= MAX_PROPERTY_IMAGES) {
    return `You can upload up to ${MAX_PROPERTY_IMAGES} images`;
  }
  if (kind === 'video' && currentVideoCount >= MAX_PROPERTY_VIDEOS) {
    return `You can upload up to ${MAX_PROPERTY_VIDEOS} video`;
  }

  return null;
}

export function countPropertyMedia(items: { type: 'image' | 'video' }[]): {
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

export function normalizePropertyMediaDraft<T extends PropertyMediaItem>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const images = sorted.filter((item) => item.type !== 'video');
  const videos = sorted.filter((item) => item.type === 'video').slice(0, MAX_PROPERTY_VIDEOS);
  const combined = [...images, ...videos];

  const hasPrimary = images.some((item) => item.isPrimary);
  const primaryId = hasPrimary ? images.find((item) => item.isPrimary)?.id : images[0]?.id;

  return combined.map((item, index) => ({
    ...item,
    order: index,
    isPrimary: item.type === 'image' ? item.id === primaryId : false,
  }));
}

/** Apply array order to `order` before normalize (drag reorder / primary toggle). */
export function sequencedPropertyMediaItems(
  images: PropertyMediaItem[],
  video: PropertyMediaItem | null,
  primaryImageId?: string
): PropertyMediaItem[] {
  const orderedImages = images.map((item, index) => ({
    ...item,
    order: index,
    ...(primaryImageId !== undefined ? { isPrimary: item.id === primaryImageId } : {}),
  }));
  return normalizePropertyMediaDraft([
    ...orderedImages,
    ...(video ? [{ ...video, order: orderedImages.length }] : []),
  ]);
}

export function partitionPropertyMedia(items: PropertyMediaItem[]): {
  images: PropertyMediaItem[];
  video: PropertyMediaItem | null;
} {
  const normalized = normalizePropertyMediaDraft(items);
  const images = normalized.filter((item) => item.type === 'image');
  const video = normalized.find((item) => item.type === 'video') ?? null;
  return { images, video };
}
