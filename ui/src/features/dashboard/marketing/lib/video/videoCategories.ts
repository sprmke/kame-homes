/** Video-only campaign categories — independent of Design's CampaignCategory. */
export type VideoCategory =
  'soft-stay' | 'flash-deal' | 'last-openings' | 'reviews' | 'fully-booked' | 'seasonal';

export const VIDEO_CATEGORIES: VideoCategory[] = [
  'soft-stay',
  'flash-deal',
  'last-openings',
  'reviews',
  'fully-booked',
  'seasonal',
];

export const VIDEO_CATEGORY_LABELS: Record<VideoCategory, string> = {
  'soft-stay': 'Soft stay',
  'flash-deal': 'Flash deal',
  'last-openings': 'Last openings',
  reviews: 'Reviews',
  'fully-booked': 'Fully booked',
  seasonal: 'Seasonal',
};

/** Retired ids still present on older autosaves / AI payloads. */
export const VIDEO_LEGACY_CATEGORY_ALIASES: Record<string, VideoCategory> = {
  'social-proof': 'reviews',
  promo: 'flash-deal',
  slots: 'last-openings',
  giveaway: 'reviews',
};

export function isVideoCategory(value: string): value is VideoCategory {
  return VIDEO_CATEGORIES.includes(value as VideoCategory);
}

export function normalizeVideoCategory(
  value: string | undefined,
  fallback: VideoCategory = 'soft-stay'
): VideoCategory {
  if (value && isVideoCategory(value)) return value;
  if (value && VIDEO_LEGACY_CATEGORY_ALIASES[value]) return VIDEO_LEGACY_CATEGORY_ALIASES[value];
  return fallback;
}
