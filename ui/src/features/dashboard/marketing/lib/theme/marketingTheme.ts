import {
  contrastRatio,
  ensureContrast,
  mixHexes,
  mixTowardBlack,
  mixTowardWhite,
  normalizeThemeHex,
  readableOn,
  relativeLuminance,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import {
  DEFAULT_MARKETING_THEME_FONTS,
  isMarketingThemeFontFamily,
  type MarketingThemeFonts,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';

/**
 * A marketing theme is the look a host picks once and every calendar, post,
 * video and AI result follows: five colors, three type roles, a background
 * style and a corner style. Mirrored in `supabase/functions/_shared/marketingTheme.ts`.
 */

export const MARKETING_THEME_VERSION = 1;

export const MARKETING_THEME_BACKGROUNDS = [
  'solid',
  'soft-gradient',
  'pattern',
  'photo-wash',
] as const;
export type MarketingThemeBackground = (typeof MARKETING_THEME_BACKGROUNDS)[number];

export const MARKETING_THEME_CORNERS = ['sharp', 'soft', 'round'] as const;
export type MarketingThemeCorners = (typeof MARKETING_THEME_CORNERS)[number];

export const MARKETING_THEME_PALETTE_ROLES = [
  'primary',
  'secondary',
  'accent',
  'surface',
  'ink',
] as const;
export type MarketingThemePaletteRole = (typeof MARKETING_THEME_PALETTE_ROLES)[number];

export type MarketingThemePalette = Record<MarketingThemePaletteRole, string>;

export type MarketingThemeTokens = {
  version: typeof MARKETING_THEME_VERSION;
  /**
   * primary: the main brand color (fills, available days, promo bands).
   * secondary: a soft supporting tone (chips, washes).
   * accent: highlights (today marker, badges, CTA).
   * surface: the paper everything sits on.
   * ink: main text on `surface`.
   */
  palette: MarketingThemePalette;
  fonts: MarketingThemeFonts;
  background: MarketingThemeBackground;
  corners: MarketingThemeCorners;
};

export type ResolvedMarketingTheme = MarketingThemePalette & {
  tokens: MarketingThemeTokens;
  onPrimary: string;
  onSecondary: string;
  onAccent: string;
  primaryDark: string;
  primaryLight: string;
  /** `ink` pushed to ≥ 7:1 on `surface`. */
  readableInk: string;
  /** Softer text, ≥ 4.5:1 on `surface`. */
  muted: string;
  isDarkSurface: boolean;
  fonts: MarketingThemeFonts;
  radius: { sm: number; md: number; lg: number };
};

export const DEFAULT_MARKETING_THEME_TOKENS: MarketingThemeTokens = {
  version: MARKETING_THEME_VERSION,
  palette: {
    primary: '#e8752a',
    secondary: '#fbe3cf',
    accent: '#c2410c',
    surface: '#fff7eb',
    ink: '#5c3d2e',
  },
  fonts: DEFAULT_MARKETING_THEME_FONTS,
  background: 'solid',
  corners: 'soft',
};

const CORNER_RADIUS: Record<MarketingThemeCorners, ResolvedMarketingTheme['radius']> = {
  sharp: { sm: 2, md: 4, lg: 6 },
  soft: { sm: 8, md: 14, lg: 22 },
  round: { sm: 14, md: 24, lg: 999 },
};

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * Strict parse for stored or API data: every field must be present and valid.
 * Returns null instead of guessing, so a corrupt row is visible rather than
 * silently restyled.
 */
export function parseMarketingThemeTokens(raw: unknown): MarketingThemeTokens | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const palette = value.palette as Record<string, unknown> | undefined;
  const fonts = value.fonts as Record<string, unknown> | undefined;
  if (!palette || typeof palette !== 'object' || !fonts || typeof fonts !== 'object') return null;

  const parsedPalette = {} as MarketingThemePalette;
  for (const role of MARKETING_THEME_PALETTE_ROLES) {
    const hex = normalizeThemeHex(palette[role]);
    if (!hex) return null;
    parsedPalette[role] = hex;
  }
  if (
    !isMarketingThemeFontFamily(fonts.display) ||
    !isMarketingThemeFontFamily(fonts.body) ||
    !isMarketingThemeFontFamily(fonts.label)
  ) {
    return null;
  }
  if (!isOneOf(MARKETING_THEME_BACKGROUNDS, value.background)) return null;
  if (!isOneOf(MARKETING_THEME_CORNERS, value.corners)) return null;

  return {
    version: MARKETING_THEME_VERSION,
    palette: parsedPalette,
    fonts: { display: fonts.display, body: fonts.body, label: fonts.label },
    background: value.background,
    corners: value.corners,
  };
}

/** Lenient: keeps every valid field from `raw` and fills the rest from `fallback`. */
export function coerceMarketingThemeTokens(
  raw: unknown,
  fallback: MarketingThemeTokens = DEFAULT_MARKETING_THEME_TOKENS
): MarketingThemeTokens {
  const strict = parseMarketingThemeTokens(raw);
  if (strict) return strict;
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const palette = (value.palette ?? {}) as Record<string, unknown>;
  const fonts = (value.fonts ?? {}) as Record<string, unknown>;
  const pick = (role: MarketingThemePaletteRole) =>
    normalizeThemeHex(palette[role]) ?? fallback.palette[role];
  const font = (role: keyof MarketingThemeFonts) =>
    isMarketingThemeFontFamily(fonts[role]) ? (fonts[role] as string) : fallback.fonts[role];
  return {
    version: MARKETING_THEME_VERSION,
    palette: {
      primary: pick('primary'),
      secondary: pick('secondary'),
      accent: pick('accent'),
      surface: pick('surface'),
      ink: pick('ink'),
    },
    fonts: { display: font('display'), body: font('body'), label: font('label') },
    background: isOneOf(MARKETING_THEME_BACKGROUNDS, value.background)
      ? value.background
      : fallback.background,
    corners: isOneOf(MARKETING_THEME_CORNERS, value.corners) ? value.corners : fallback.corners,
  };
}

/** Derived roles with contrast guarantees. Pure and cheap; memoize per token object. */
export function resolveMarketingTheme(tokens: MarketingThemeTokens): ResolvedMarketingTheme {
  const { primary, secondary, accent, surface, ink } = tokens.palette;
  const isDarkSurface = relativeLuminance(surface) < 0.3;
  const readableInk = ensureContrast(ink, surface, 7);
  const muted = ensureContrast(mixHexes(readableInk, surface, 0.35), surface, 4.5);
  const darkText = isDarkSurface ? surface : readableInk;
  return {
    ...tokens.palette,
    tokens,
    onPrimary: readableOn(primary, '#ffffff', darkText),
    onSecondary: readableOn(secondary, '#ffffff', darkText),
    onAccent: readableOn(accent, '#ffffff', darkText),
    primaryDark: mixTowardBlack(primary, 0.18),
    primaryLight: mixTowardWhite(primary, 0.38),
    readableInk,
    muted,
    isDarkSurface,
    fonts: tokens.fonts,
    radius: CORNER_RADIUS[tokens.corners],
  };
}

/** True when two token sets render identically. */
export function sameMarketingTheme(a: MarketingThemeTokens, b: MarketingThemeTokens): boolean {
  return marketingThemeHash(a) === marketingThemeHash(b);
}

/** Canonical JSON (fixed key order) so the hash never depends on insertion order. */
function canonicalTokens(tokens: MarketingThemeTokens): string {
  return JSON.stringify([
    tokens.version,
    MARKETING_THEME_PALETTE_ROLES.map((role) => tokens.palette[role].toLowerCase()),
    [tokens.fonts.display, tokens.fonts.body, tokens.fonts.label],
    tokens.background,
    tokens.corners,
  ]);
}

/** Short stable hash (FNV-1a 32-bit, base36) for cache keys and "theme changed" checks. */
export function marketingThemeHash(tokens: MarketingThemeTokens): string {
  const input = canonicalTokens(tokens);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Lowest contrast among the pairs a host will actually read (for the editor's warning). */
export function marketingThemeContrastIssues(
  tokens: MarketingThemeTokens
): Array<{ pair: string; ratio: number; min: number }> {
  const { primary, surface, ink, accent } = tokens.palette;
  const resolved = resolveMarketingTheme(tokens);
  const checks = [
    { pair: 'Text on background', ratio: contrastRatio(ink, surface), min: 4.5 },
    { pair: 'Text on main color', ratio: contrastRatio(resolved.onPrimary, primary), min: 3 },
    { pair: 'Highlight on background', ratio: contrastRatio(accent, surface), min: 1.6 },
  ];
  return checks.filter((c) => c.ratio < c.min);
}
