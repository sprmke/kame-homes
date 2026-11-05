/**
 * Marketing theme tokens — server copy of
 * `ui/src/features/dashboard/marketing/lib/theme/marketingTheme.ts` (parse only).
 * `marketingThemeEdgeParity.test.ts` (UI) keeps the enums and font list in sync.
 */

export const MARKETING_THEME_VERSION = 1;

export const MARKETING_THEME_BACKGROUNDS = ['solid', 'soft-gradient', 'pattern', 'photo-wash'];

export const MARKETING_THEME_CORNERS = ['sharp', 'soft', 'round'];

export const MARKETING_THEME_PHOTO_LOOKS = [
  'golden-hour',
  'bright-airy',
  'evening-glow',
  'blue-hour',
  'rainy-cozy',
  'editorial',
  'detail',
];

export const MARKETING_THEME_PALETTE_ROLES = ['primary', 'secondary', 'accent', 'surface', 'ink'];

export const MARKETING_THEME_FONT_FAMILIES = [
  'Fraunces',
  'Playfair Display',
  'Cormorant Garamond',
  'Lora',
  'Instrument Serif',
  'DM Sans',
  'Plus Jakarta Sans',
  'Outfit',
  'Manrope',
  'Sora',
  'Jost',
  'Figtree',
  'Nunito Sans',
  'Inter Tight',
  'Space Grotesk',
  'Poppins',
  'Montserrat',
  'Lato',
  'Open Sans',
  'Inter',
];

/** Built-in theme keys are code-defined on the client; rows use UUIDs. */
export const BUILTIN_THEME_KEY_RE = /^(property-colors|starter:[a-z0-9-]{1,60})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MarketingThemeTokens = {
  version: 1;
  palette: Record<'primary' | 'secondary' | 'accent' | 'surface' | 'ink', string>;
  fonts: { display: string; body: string; label: string };
  background: string;
  corners: string;
  /** Optional default light and mood for AI Photo / Video. */
  photoLook?: string;
};

function photoLookField(value: unknown): { photoLook?: string } {
  return typeof value === 'string' && MARKETING_THEME_PHOTO_LOOKS.includes(value)
    ? { photoLook: value }
    : {};
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).toLowerCase().split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/** Strict: every field present and allow-listed, or null. */
export function parseMarketingThemeTokens(raw: unknown): MarketingThemeTokens | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const palette = value.palette as Record<string, unknown> | undefined;
  const fonts = value.fonts as Record<string, unknown> | undefined;
  if (!palette || typeof palette !== 'object' || !fonts || typeof fonts !== 'object') return null;

  const parsedPalette: Record<string, string> = {};
  for (const role of MARKETING_THEME_PALETTE_ROLES) {
    const hex = normalizeHex(palette[role]);
    if (!hex) return null;
    parsedPalette[role] = hex;
  }
  for (const role of ['display', 'body', 'label']) {
    if (
      typeof fonts[role] !== 'string' ||
      !MARKETING_THEME_FONT_FAMILIES.includes(fonts[role] as string)
    ) {
      return null;
    }
  }
  if (
    typeof value.background !== 'string' ||
    !MARKETING_THEME_BACKGROUNDS.includes(value.background)
  ) {
    return null;
  }
  if (typeof value.corners !== 'string' || !MARKETING_THEME_CORNERS.includes(value.corners)) {
    return null;
  }

  return {
    version: MARKETING_THEME_VERSION,
    palette: parsedPalette as MarketingThemeTokens['palette'],
    fonts: {
      display: fonts.display as string,
      body: fonts.body as string,
      label: fonts.label as string,
    },
    background: value.background,
    corners: value.corners,
    ...photoLookField(value.photoLook),
  };
}

/** A key a template may carry: a built-in key or a theme row id. */
export function isMarketingThemeKey(value: unknown): value is string {
  return typeof value === 'string' && (BUILTIN_THEME_KEY_RE.test(value) || UUID_RE.test(value));
}

export function isMarketingThemeRowId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Trimmed, single-spaced, 1–60 chars, or null. */
export function normalizeMarketingThemeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name || name.length > 60) return null;
  return name;
}

/** Same defaults as the client's `DEFAULT_MARKETING_THEME_TOKENS` (Quiet Coast). */
export const DEFAULT_MARKETING_THEME_TOKENS: MarketingThemeTokens = {
  version: 1,
  palette: {
    primary: '#e8752a',
    secondary: '#fbe3cf',
    accent: '#c2410c',
    surface: '#fff7eb',
    ink: '#5c3d2e',
  },
  fonts: { display: 'Fraunces', body: 'Plus Jakarta Sans', label: 'Jost' },
  background: 'solid',
  corners: 'soft',
};

/** Lenient: keeps every valid field from `raw`, fills the rest from the defaults. */
export function coerceMarketingThemeTokens(
  raw: unknown,
  fallback: MarketingThemeTokens = DEFAULT_MARKETING_THEME_TOKENS
): MarketingThemeTokens {
  const strict = parseMarketingThemeTokens(raw);
  if (strict) return strict;
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const palette = (value.palette && typeof value.palette === 'object' ? value.palette : {}) as Record<
    string,
    unknown
  >;
  const fonts = (value.fonts && typeof value.fonts === 'object' ? value.fonts : {}) as Record<
    string,
    unknown
  >;
  const pick = (role: keyof MarketingThemeTokens['palette']) =>
    normalizeHex(palette[role]) ?? fallback.palette[role];
  const font = (role: keyof MarketingThemeTokens['fonts']) =>
    typeof fonts[role] === 'string' && MARKETING_THEME_FONT_FAMILIES.includes(fonts[role] as string)
      ? (fonts[role] as string)
      : fallback.fonts[role];
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
    background:
      typeof value.background === 'string' && MARKETING_THEME_BACKGROUNDS.includes(value.background)
        ? value.background
        : fallback.background,
    corners:
      typeof value.corners === 'string' && MARKETING_THEME_CORNERS.includes(value.corners)
        ? value.corners
        : fallback.corners,
    ...photoLookField(value.photoLook),
  };
}
