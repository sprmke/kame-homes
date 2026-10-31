/** Secondary marketing links + socials shared by `MarketingFooter` (lg+) and `MarketingMoreSheet` (phone). */
export type MarketingSiteLink = { href: string; label: string; switchesToHost?: boolean };

export const marketingHostLinks: readonly MarketingSiteLink[] = [
  { href: '/for-hosts', label: 'Become a host', switchesToHost: true },
  { href: '/for-hosts/pricing', label: 'Pricing' },
  { href: '/support', label: 'Support' },
];

export const marketingCompanyLinks: readonly MarketingSiteLink[] = [
  { href: '/about', label: 'About us' },
  { href: '/contact', label: 'Contact' },
];

export const marketingLegalLinks: readonly MarketingSiteLink[] = [
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of service' },
  { href: '/cookies', label: 'Cookie policy' },
];

export type MarketingSocialLabel = 'Facebook' | 'Instagram' | 'Twitter';
export type MarketingSocialLink = { href: string; label: MarketingSocialLabel };

/** Only well-formed https URLs render — an unset or bad env var hides the link, never a dead one. */
export function resolveSocialLinks(env: {
  facebook?: string;
  instagram?: string;
  twitter?: string;
}): MarketingSocialLink[] {
  const entries: [MarketingSocialLabel, string | undefined][] = [
    ['Facebook', env.facebook],
    ['Instagram', env.instagram],
    ['Twitter', env.twitter],
  ];
  return entries.flatMap(([label, raw]) => {
    const value = raw?.trim();
    if (!value) return [];
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? [{ href: url.toString(), label }] : [];
    } catch {
      return [];
    }
  });
}

/** Display phone -> `tel:` link, or `null` when unset or not a plausible number. */
export function resolveContactPhone(
  raw: string | undefined
): { href: string; label: string } | null {
  const label = raw?.trim();
  if (!label) return null;
  const digits = label.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 7) return null;
  return { href: `tel:${digits}`, label };
}

export const marketingSocialLinks = resolveSocialLinks({
  facebook: import.meta.env.VITE_PLATFORM_SOCIAL_FACEBOOK,
  instagram: import.meta.env.VITE_PLATFORM_SOCIAL_INSTAGRAM,
  twitter: import.meta.env.VITE_PLATFORM_SOCIAL_TWITTER,
});

export const marketingContactPhone = resolveContactPhone(
  import.meta.env.VITE_PLATFORM_CONTACT_PHONE
);
