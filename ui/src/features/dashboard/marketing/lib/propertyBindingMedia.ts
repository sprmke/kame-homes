import type { DesignBindingMedia } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { MARKETING_THUMB_STOCK_PHOTOS } from '@/features/dashboard/marketing/lib/marketingDefaultBinding';

export function inferBackgroundMediaType(url: string | null | undefined): 'image' | 'video' {
  if (!url?.trim()) return 'image';
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (/\.(mp4|webm|mov|avi|mkv|ogv|mpeg|mpg)(#|$)/i.test(path)) return 'video';
  return 'image';
}

/** Gallery order for default video scenes — property settings first, stock only when empty. */
export function resolveDesignBindingMedia(input: {
  propertyMedia?: DesignBindingMedia[];
  images?: string[];
  propertyPhoto?: string | null;
}): DesignBindingMedia[] {
  if (input.propertyMedia?.length) {
    return input.propertyMedia.filter((item) => item.url.trim());
  }

  const fromImages = (input.images ?? []).filter(Boolean).map((url) => ({
    url,
    type: 'image' as const,
  }));
  if (fromImages.length > 0) return fromImages;

  if (input.propertyPhoto?.trim()) {
    return [{ url: input.propertyPhoto, type: 'image' as const }];
  }

  return MARKETING_THUMB_STOCK_PHOTOS.map((url) => ({ url, type: 'image' as const }));
}

export function pickBindingMediaAt(
  media: DesignBindingMedia[],
  index: number
): { url: string | null; mediaType: 'image' | 'video' } {
  if (media.length === 0) return { url: null, mediaType: 'image' };
  const item = media[index % media.length]!;
  return { url: item.url, mediaType: item.type };
}

export function primaryBindingPhoto(media: DesignBindingMedia[]): string | null {
  const firstImage = media.find((item) => item.type === 'image');
  return firstImage?.url ?? media[0]?.url ?? null;
}
