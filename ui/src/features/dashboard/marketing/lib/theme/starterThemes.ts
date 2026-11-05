import { resolveCalendarPresetStyles } from '@/features/dashboard/marketing/components/calendar-builder/stores/calendarBuilderStore';
import type {
  BackgroundConfig,
  CalendarStyles,
} from '@/features/dashboard/marketing/components/calendar-builder/types';
import { CALENDAR_PRESET_CATEGORIES } from '@/features/dashboard/marketing/lib/calendarPresets';
import type { MarketingAiTokenPalette } from '@/features/dashboard/marketing/lib/marketingAiPhotoPalette';
import {
  DEFAULT_MARKETING_THEME_TOKENS,
  MARKETING_THEME_VERSION,
  type MarketingThemeBackground,
  type MarketingThemeCorners,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  ensureContrast,
  mixTowardBlack,
  mixTowardWhite,
  normalizeThemeHex,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import {
  DEFAULT_MARKETING_THEME_FONTS,
  isMarketingThemeFontFamily,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';

import { clampChannel, hslToHex, parseHexRgb, rgbToHsl } from '@/lib/theme/colorConvert';

/**
 * Ready-made themes. The 14 calendar looks are derived from the preset styles
 * themselves (not retyped), so a starter theme is by construction the palette
 * its layout was designed in, and pairing them renders the original preset.
 */

export type StarterTheme = {
  id: string;
  label: string;
  group: string;
  tokens: MarketingThemeTokens;
  /** Calendar layout this look was designed for (opened first in that theme). */
  calendarLayoutId?: string;
};

export const QUIET_COAST_STARTER_ID = 'quiet-coast';
export const BLANK_CALENDAR_LAYOUT_ID = 'default';

function backgroundColor(background: BackgroundConfig | undefined): string | null {
  if (!background) return null;
  if (background.type === 'gradient') {
    return (
      normalizeThemeHex(background.gradient?.stops?.[0]?.color) ??
      normalizeThemeHex(background.color)
    );
  }
  return normalizeThemeHex(background.color);
}

function backgroundStyleOf(background: BackgroundConfig | undefined): MarketingThemeBackground {
  switch (background?.type) {
    case 'gradient':
      return 'soft-gradient';
    case 'pattern':
      return 'pattern';
    case 'image':
      return 'photo-wash';
    default:
      return 'solid';
  }
}

function cornersOf(styles: CalendarStyles): MarketingThemeCorners {
  const radius = Math.max(styles.cell.borderRadius ?? 0, styles.cell.border?.radius ?? 0);
  if (radius >= 100) return 'round';
  if (radius >= 8) return 'soft';
  return 'sharp';
}

function fontOr(value: string | undefined, fallback: string): string {
  return isMarketingThemeFontFamily(value) ? value : fallback;
}

/**
 * The theme a set of calendar styles was authored in. `card` swatches (preset
 * picker colors) define primary/secondary when known; the rest comes from the
 * styles: surface = card background, ink = month title, accent = today marker.
 */
export function deriveThemeTokensFromCalendarStyles(
  styles: CalendarStyles,
  card?: { color?: string; secondary?: string }
): MarketingThemeTokens {
  const fallback = DEFAULT_MARKETING_THEME_TOKENS.palette;
  const surface = backgroundColor(styles.container.background) ?? '#ffffff';
  const ink = normalizeThemeHex(styles.header.monthYear.color) ?? fallback.ink;
  const todayBorder =
    styles.today.border.width > 0 ? normalizeThemeHex(styles.today.border.color) : null;
  const accent =
    todayBorder ??
    backgroundColor(styles.today.background) ??
    normalizeThemeHex(styles.today.dayNumberColor) ??
    fallback.accent;
  const primary =
    normalizeThemeHex(card?.color) ??
    backgroundColor(styles.booked.background) ??
    backgroundColor(styles.available.background) ??
    fallback.primary;
  const secondary =
    normalizeThemeHex(card?.secondary) ??
    backgroundColor(styles.available.background) ??
    mixTowardWhite(primary, 0.8);

  return {
    version: MARKETING_THEME_VERSION,
    palette: { primary, secondary, accent, surface, ink },
    fonts: {
      display: fontOr(styles.header.monthYear.font.family, DEFAULT_MARKETING_THEME_FONTS.display),
      body: fontOr(styles.cell.dayNumber.font.family, DEFAULT_MARKETING_THEME_FONTS.body),
      label: fontOr(styles.dayNames.font.family, DEFAULT_MARKETING_THEME_FONTS.label),
    },
    background: backgroundStyleOf(styles.container.background),
    corners: cornersOf(styles),
  };
}

let calendarStarterCache: Map<string, StarterTheme> | null = null;

function calendarStarters(): Map<string, StarterTheme> {
  if (calendarStarterCache) return calendarStarterCache;
  const map = new Map<string, StarterTheme>();
  for (const category of CALENDAR_PRESET_CATEGORIES) {
    for (const preset of category.presets) {
      map.set(preset.value, {
        id: preset.value,
        label: preset.label,
        group: category.label,
        tokens: deriveThemeTokensFromCalendarStyles(resolveCalendarPresetStyles(preset.value), {
          color: preset.color,
          secondary: preset.secondary,
        }),
        calendarLayoutId: preset.value,
      });
    }
  }
  calendarStarterCache = map;
  return map;
}

/** The theme a calendar layout was designed in (Blank → its own neutral default). */
export function calendarLayoutSourceTokens(layoutId: string): MarketingThemeTokens {
  const starter = calendarStarters().get(layoutId);
  if (starter) return starter.tokens;
  return deriveThemeTokensFromCalendarStyles(resolveCalendarPresetStyles(BLANK_CALENDAR_LAYOUT_ID));
}

export const QUIET_COAST_STARTER: StarterTheme = {
  id: QUIET_COAST_STARTER_ID,
  label: 'Quiet Coast',
  group: 'Classic',
  tokens: DEFAULT_MARKETING_THEME_TOKENS,
};

/** Every built-in starter, in picker order. */
export function listStarterThemes(): StarterTheme[] {
  return [QUIET_COAST_STARTER, ...calendarStarters().values()];
}

export function findStarterTheme(id: string): StarterTheme | null {
  if (id === QUIET_COAST_STARTER_ID) return QUIET_COAST_STARTER;
  return calendarStarters().get(id) ?? null;
}

/**
 * "Property colors": built from the property's photo palette (or brand color).
 * `tokenPalette` is `resolveMarketingAiLookPresentation(...).tokenPalette`:
 * accent = the sampled color, primary = its soft fill, secondary = cream canvas.
 */
export function buildPropertyColorsThemeTokens(
  tokenPalette: MarketingAiTokenPalette,
  ink?: string
): MarketingThemeTokens {
  const brand =
    normalizeThemeHex(tokenPalette.accent) ?? DEFAULT_MARKETING_THEME_TOKENS.palette.primary;
  const surface = normalizeThemeHex(tokenPalette.secondary) ?? '#fbf8f3';
  const rgb = parseHexRgb(brand);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : { h: 28, s: 70, l: 50 };
  // A neighbouring hue for highlights reads designed, not monochrome.
  const highlight = hslToHex(
    (hsl.h + 32) % 360,
    clampChannel(hsl.s, 45, 85),
    clampChannel(hsl.l, 48, 60)
  );
  const baseInk = normalizeThemeHex(ink) ?? mixTowardBlack(brand, 0.72);
  return {
    version: MARKETING_THEME_VERSION,
    palette: {
      primary: brand,
      secondary: normalizeThemeHex(tokenPalette.primary) ?? mixTowardWhite(brand, 0.6),
      accent: highlight,
      surface,
      ink: ensureContrast(baseInk, surface, 7),
    },
    fonts: DEFAULT_MARKETING_THEME_FONTS,
    background: 'solid',
    corners: 'soft',
  };
}
