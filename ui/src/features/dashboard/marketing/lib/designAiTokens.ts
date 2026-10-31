/**
 * AI-generated design token schema for the Polotno/Canvas editor.
 * Tokens are produced by the shared edge function and compiled into a
 * `PolotnoDesignDocument` by `polotnoAiCampaignDocuments.ts`.
 */

export type DesignLayoutArchetype =
  | 'hero-photo'
  | 'split-panel'
  | 'centered-card'
  | 'editorial-minimal'
  | 'gradient-frame'
  | 'photo-bottom'
  | 'left-stack';

export type DesignFontPairing =
  'serif-editorial' | 'clean-sans' | 'modern-sleek' | 'rounded-friendly';

export type DesignBackgroundMood = 'photo' | 'solid' | 'gradient' | 'color-wash';

export type DesignCampaignCategory =
  'promo' | 'slots' | 'giveaway' | 'fully-booked' | 'reviews' | 'custom';

export type DesignTemplateTokens = {
  layoutArchetype: DesignLayoutArchetype;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fontPairing: DesignFontPairing;
  backgroundMood: DesignBackgroundMood;
  category: DesignCampaignCategory;
  copy: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    detail: string;
    cta: string;
  };
  label: string;
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function isHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

const DESIGN_ARCHETYPES: DesignLayoutArchetype[] = [
  'hero-photo',
  'split-panel',
  'centered-card',
  'editorial-minimal',
  'gradient-frame',
  'photo-bottom',
  'left-stack',
];

const DESIGN_FONTS: DesignFontPairing[] = [
  'serif-editorial',
  'clean-sans',
  'modern-sleek',
  'rounded-friendly',
];

const DESIGN_BACKGROUNDS: DesignBackgroundMood[] = ['photo', 'solid', 'gradient', 'color-wash'];

const DESIGN_CATEGORIES: DesignCampaignCategory[] = [
  'promo',
  'slots',
  'giveaway',
  'fully-booked',
  'reviews',
  'custom',
];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

/** Truncates at the last whitespace before `max` so AI copy never gets cut mid-word. */
function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > max * 0.4 ? slice.slice(0, lastSpace).trimEnd() : slice;
}

function clampText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = truncateAtWordBoundary(value.replace(/\s+/g, ' ').trim(), max);
  return cleaned || fallback;
}

const CATEGORY_FALLBACK_COPY: Record<
  DesignCampaignCategory,
  Omit<DesignTemplateTokens['copy'], never>
> = {
  promo: {
    eyebrow: 'Special Offer',
    headline: 'Save on your stay',
    subheadline: 'Book direct for the best rate.',
    detail: 'Limited dates available this month.',
    cta: 'Book now',
  },
  slots: {
    eyebrow: 'Last Chance',
    headline: 'Only a few slots left',
    subheadline: 'Secure your dates before they are gone.',
    detail: 'Limited openings this month.',
    cta: 'Reserve now',
  },
  giveaway: {
    eyebrow: 'Giveaway',
    headline: 'Win a free stay',
    subheadline: 'Enter for a chance to be our guest.',
    detail: 'Follow the steps to join the draw.',
    cta: 'Enter to win',
  },
  'fully-booked': {
    eyebrow: 'Fully Booked',
    headline: 'Join the waitlist',
    subheadline: 'Be the first to know when dates open up.',
    detail: 'Drop your details and we will notify you.',
    cta: 'Notify me',
  },
  reviews: {
    eyebrow: 'Guest love',
    headline: 'Felt like home',
    subheadline: 'A five-star stay our guests still talk about.',
    detail: '★★★★★',
    cta: 'Book your stay',
  },
  custom: {
    eyebrow: 'Featured',
    headline: 'Stay with us',
    subheadline: 'Experience comfort and style.',
    detail: 'Book your perfect getaway today.',
    cta: 'Book now',
  },
};

export function normalizeDesignTemplateTokens(
  raw: Partial<DesignTemplateTokens> | null | undefined
): DesignTemplateTokens {
  const paletteRaw = (raw?.palette ?? {}) as Record<string, unknown>;
  const copyRaw = (raw?.copy ?? {}) as Record<string, unknown>;
  const category = pickEnum(raw?.category, DESIGN_CATEGORIES, 'promo');
  const fallback = CATEGORY_FALLBACK_COPY[category];
  return {
    layoutArchetype: pickEnum(raw?.layoutArchetype, DESIGN_ARCHETYPES, 'hero-photo'),
    palette: {
      primary: normalizeHex(paletteRaw.primary as string | undefined, '#24a88e'),
      secondary: normalizeHex(paletteRaw.secondary as string | undefined, '#fff7eb'),
      accent: normalizeHex(paletteRaw.accent as string | undefined, '#e8752a'),
    },
    fontPairing: pickEnum(raw?.fontPairing, DESIGN_FONTS, 'serif-editorial'),
    backgroundMood: pickEnum(raw?.backgroundMood, DESIGN_BACKGROUNDS, 'gradient'),
    category,
    copy: {
      eyebrow: clampText(copyRaw.eyebrow as string | undefined, fallback.eyebrow, 40),
      headline: clampText(copyRaw.headline as string | undefined, fallback.headline, 80),
      subheadline: clampText(copyRaw.subheadline as string | undefined, fallback.subheadline, 80),
      detail: clampText(copyRaw.detail as string | undefined, fallback.detail, 120),
      cta: clampText(copyRaw.cta as string | undefined, fallback.cta, 30),
    },
    label: clampText(raw?.label, 'AI design', 40),
  };
}

export function isDesignAiHex(value: string): boolean {
  return isHex(value);
}
