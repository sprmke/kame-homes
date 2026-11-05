import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  mixTowardBlack,
  mixTowardWhite,
  parseCssColor,
  rgbToOklab,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

/**
 * Choices for the theme editor's color controls. Hosts never type color codes:
 * they pick a whole palette, then nudge one color with shades or suggestions.
 */

export type ThemePalette = MarketingThemeTokens['palette'];
export type ThemePaletteRole = keyof ThemePalette;

export type PaletteSuggestion = { key: string; label: string; palette: ThemePalette };

function oklab(hex: string) {
  const parsed = parseCssColor(hex);
  return parsed ? rgbToOklab(parsed) : null;
}

/** Perceptual distance (OKLab); unparsable colors count as far apart. */
export function colorDistance(a: string, b: string): number {
  const x = oklab(a);
  const y = oklab(b);
  if (!x || !y) return Infinity;
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
}

function paletteDistance(a: ThemePalette, b: ThemePalette): number {
  // Main and highlight carry the look; soft and surface tones are mostly near-white.
  return Math.max(colorDistance(a.primary, b.primary), colorDistance(a.accent, b.accent));
}

export function samePalette(a: ThemePalette, b: ThemePalette): boolean {
  return (Object.keys(a) as ThemePaletteRole[]).every(
    (role) => a[role].toLowerCase() === b[role].toLowerCase()
  );
}

/**
 * Keeps the first of any palettes that look alike, in order, up to `max`.
 * The starter looks share many pastels; showing near-duplicates side by side
 * only makes the choice harder.
 */
export function distinctPalettes(
  options: readonly PaletteSuggestion[],
  max: number,
  minDistance = 0.08
): PaletteSuggestion[] {
  const picked: PaletteSuggestion[] = [];
  for (const option of options) {
    if (picked.length >= max) break;
    if (picked.every((p) => paletteDistance(p.palette, option.palette) >= minDistance)) {
      picked.push(option);
    }
  }
  return picked;
}

/** Lighter → darker steps of one color, with the color itself in the middle. */
export function colorShades(hex: string): string[] {
  return [
    mixTowardWhite(hex, 0.6),
    mixTowardWhite(hex, 0.3),
    hex.toLowerCase(),
    mixTowardBlack(hex, 0.25),
    mixTowardBlack(hex, 0.5),
  ];
}

/** Other colors the starter looks use for this role, without near-duplicates. */
export function roleColorSuggestions(
  role: ThemePaletteRole,
  palettes: readonly ThemePalette[],
  max = 10,
  minDistance = 0.06
): string[] {
  const picked: string[] = [];
  for (const palette of palettes) {
    if (picked.length >= max) break;
    const color = palette[role].toLowerCase();
    if (picked.every((existing) => colorDistance(existing, color) >= minDistance)) {
      picked.push(color);
    }
  }
  return picked;
}
