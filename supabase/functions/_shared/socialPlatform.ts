/**
 * Shared social-platform helpers for guest review CTAs.
 */

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

/** Prefer explicit main when its URL is filled; else first filled platform in display order. */
export function resolveMainSocialPlatform(
  preferred: string | null | undefined,
  urls: SocialUrlMap
): SocialPlatform | null {
  const preferredParsed = parseSocialPlatform(preferred);
  if (preferredParsed && urls[preferredParsed].trim()) {
    return preferredParsed;
  }
  for (const platform of SOCIAL_PLATFORMS) {
    if (urls[platform].trim()) return platform;
  }
  return null;
}

export function resolveMainSocialUrl(
  preferred: string | null | undefined,
  urls: SocialUrlMap
): { platform: SocialPlatform; url: string } | null {
  const platform = resolveMainSocialPlatform(preferred, urls);
  if (!platform) return null;
  const url = urls[platform].trim();
  if (!url) return null;
  return { platform, url };
}
