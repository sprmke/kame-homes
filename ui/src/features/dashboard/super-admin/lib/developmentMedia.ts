import {
  normalizePropertyMediaDraft,
  partitionPropertyMedia,
} from '@/features/dashboard/org/lib/propertyMedia';
import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';
import type { Development } from '@/features/dashboard/super-admin/types/development';

function readStringArray(settings: Record<string, unknown>, key: string): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function legacyUrlsToMedia(coverImageUrl: string | null, imageUrls: string[]): PropertyMediaItem[] {
  const urls = imageUrls.length > 0 ? imageUrls : coverImageUrl ? [coverImageUrl] : [];
  if (urls.length === 0) return [];

  const cover = coverImageUrl?.trim() || urls[0]!;
  return normalizePropertyMediaDraft(
    urls.map((url, index) => ({
      id: `legacy-${index}-${url.slice(-24)}`,
      url,
      type: 'image' as const,
      order: index,
      isPrimary: url === cover || (index === 0 && !urls.includes(cover)),
    }))
  );
}

export function readDevelopmentMedia(development: Development): PropertyMediaItem[] {
  const settings = development.settings ?? {};
  const rawMedia = settings.media;
  if (Array.isArray(rawMedia) && rawMedia.length > 0) {
    return normalizePropertyMediaDraft(rawMedia as PropertyMediaItem[]);
  }

  return legacyUrlsToMedia(development.coverImageUrl, readStringArray(settings, 'images'));
}

export function developmentMediaToLegacyFields(media: PropertyMediaItem[]) {
  const normalized = normalizePropertyMediaDraft(media);
  const { images } = partitionPropertyMedia(normalized);
  const primary = images.find((item) => item.isPrimary) ?? images[0];

  return {
    media: normalized,
    coverImageUrl: primary?.url ?? '',
    images: images.map((item) => item.url),
  };
}
