export const SOCIAL_PLATFORMS = ['facebook', 'airbnb', 'instagram', 'tiktok'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  airbnb: 'Airbnb',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

export function isSocialPlatform(value: string | null | undefined): value is SocialPlatform {
  return SOCIAL_PLATFORMS.includes((value ?? '').trim() as SocialPlatform);
}

export function parseSocialPlatform(value: string | null | undefined): SocialPlatform | null {
  const trimmed = (value ?? '').trim();
  return isSocialPlatform(trimmed) ? trimmed : null;
}

export type SocialUrlMap = Record<SocialPlatform, string>;
