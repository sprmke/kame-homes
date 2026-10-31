import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  isSocialPlatform,
  parseSocialPlatform,
  type SocialPlatform,
  type SocialUrlMap,
} from '@/features/dashboard/org/lib/socialPlatformTypes';

export {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  isSocialPlatform,
  parseSocialPlatform,
  type SocialPlatform,
  type SocialUrlMap,
};

export type SocialLinkKey = 'facebookPageUrl' | 'airbnbUrl' | 'instagramUrl' | 'tiktokUrl';

export type SocialLinkMode = 'inherit' | 'custom';

export function socialLinkModeFromStored(stored: string): SocialLinkMode {
  return stored.trim() === '' ? 'inherit' : 'custom';
}

export type OrgSocialLinks = Record<SocialLinkKey, string>;

export const SOCIAL_LINK_KEYS: SocialLinkKey[] = [
  'facebookPageUrl',
  'airbnbUrl',
  'instagramUrl',
  'tiktokUrl',
];

export function socialLinkModesFromDraft(
  draft: Record<SocialLinkKey, string>
): Record<SocialLinkKey, SocialLinkMode> {
  return Object.fromEntries(
    SOCIAL_LINK_KEYS.map((key) => [key, socialLinkModeFromStored(draft[key])])
  ) as Record<SocialLinkKey, SocialLinkMode>;
}

export const SOCIAL_LINK_TO_PLATFORM: Record<SocialLinkKey, SocialPlatform> = {
  facebookPageUrl: 'facebook',
  airbnbUrl: 'airbnb',
  instagramUrl: 'instagram',
  tiktokUrl: 'tiktok',
};

export const PLATFORM_TO_SOCIAL_LINK: Record<SocialPlatform, SocialLinkKey> = {
  facebook: 'facebookPageUrl',
  airbnb: 'airbnbUrl',
  instagram: 'instagramUrl',
  tiktok: 'tiktokUrl',
};

export const SOCIAL_LINK_FIELD_IDS: Record<SocialLinkKey, string> = {
  facebookPageUrl: 'property-facebook-page-url',
  airbnbUrl: 'property-airbnb-url',
  instagramUrl: 'property-instagram-url',
  tiktokUrl: 'property-tiktok-url',
};

export const SOCIAL_LINK_LABELS: Record<SocialLinkKey, string> = {
  facebookPageUrl: 'Facebook',
  airbnbUrl: 'Airbnb',
  instagramUrl: 'Instagram',
  tiktokUrl: 'TikTok',
};

/** Empty stored value = inherit organization link. */
export function propertySocialLinkInherits(stored: string): boolean {
  return stored.trim() === '';
}

export function effectiveSocialLink(stored: string, orgValue: string): string {
  const trimmed = stored.trim();
  if (trimmed) return trimmed;
  return orgValue.trim();
}

/** DB patch — clear override when empty or identical to org (avoid duplicate storage). */
export function propertySocialLinkStoredValue(stored: string, orgValue: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return '';
  if (trimmed === orgValue.trim()) return '';
  return trimmed;
}

export function propertySocialLinksEquivalent(
  left: string,
  right: string,
  orgValue: string
): boolean {
  return (
    propertySocialLinkStoredValue(left, orgValue).toLowerCase() ===
    propertySocialLinkStoredValue(right, orgValue).toLowerCase()
  );
}

export function allPropertySocialLinksInherit(draft: Record<SocialLinkKey, string>): boolean {
  return SOCIAL_LINK_KEYS.every((key) => propertySocialLinkInherits(draft[key]));
}

export function anyPropertySocialLinkCustom(draft: Record<SocialLinkKey, string>): boolean {
  return SOCIAL_LINK_KEYS.some((key) => !propertySocialLinkInherits(draft[key]));
}

export function socialUrlMapFromLinks(links: Record<SocialLinkKey, string>): SocialUrlMap {
  return {
    facebook: links.facebookPageUrl.trim(),
    airbnb: links.airbnbUrl.trim(),
    instagram: links.instagramUrl.trim(),
    tiktok: links.tiktokUrl.trim(),
  };
}

export function effectiveSocialUrlMap(
  property: Record<SocialLinkKey, string>,
  org: Record<SocialLinkKey, string>
): SocialUrlMap {
  return effectiveSocialUrlMapWithModes(property, org, socialLinkModesFromDraft(property));
}

export function effectiveSocialUrlMapWithModes(
  property: Record<SocialLinkKey, string>,
  org: Record<SocialLinkKey, string>,
  modes: Record<SocialLinkKey, SocialLinkMode>
): SocialUrlMap {
  return SOCIAL_LINK_KEYS.reduce((acc, key) => {
    const platform = SOCIAL_LINK_TO_PLATFORM[key];
    acc[platform] =
      modes[key] === 'custom' ? property[key].trim() : effectiveSocialLink(property[key], org[key]);
    return acc;
  }, {} as SocialUrlMap);
}

export function normalizePropertySocialLinksForSave(
  draft: Record<SocialLinkKey, string>,
  orgSocialLinks: OrgSocialLinks
): Record<SocialLinkKey, string> {
  return {
    facebookPageUrl: propertySocialLinkStoredValue(
      draft.facebookPageUrl,
      orgSocialLinks.facebookPageUrl
    ),
    airbnbUrl: propertySocialLinkStoredValue(draft.airbnbUrl, orgSocialLinks.airbnbUrl),
    instagramUrl: propertySocialLinkStoredValue(draft.instagramUrl, orgSocialLinks.instagramUrl),
    tiktokUrl: propertySocialLinkStoredValue(draft.tiktokUrl, orgSocialLinks.tiktokUrl),
  };
}

export function countFilledSocialUrls(urls: SocialUrlMap): number {
  return SOCIAL_PLATFORMS.filter((p) => urls[p].trim()).length;
}
