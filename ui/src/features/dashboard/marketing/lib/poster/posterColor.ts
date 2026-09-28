import { hslToHex, mixHexToward, parseHexRgb, rgbToHsl, type Rgb } from '@/lib/theme/colorConvert';

/**
 * Poster palettes. The AI (or host) supplies at most three hexes; everything text
 * sits on is derived here with WCAG contrast guarantees, so a bad pick can make a
 * poster less pretty but never unreadable.
 */

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WARM_CREAM: Rgb = { r: 250, g: 240, b: 225 };
const NIGHT_NAVY: Rgb = { r: 12, g: 24, b: 52 };

export const DEFAULT_POSTER_ACCENT = '#b86a2c';

export type PosterPalette = {
  /** Brand accent: pills, banners, icon strokes on light fields. */
  accent: string;
  /** Text on `accent`. */
  onAccent: string;
  /** Second tone (two-tone headlines, badges). */
  secondary: string;
  onSecondary: string;
  /** Light "paper" field (info bars, cream panels). */
  field: string;
  /** Primary text on `field`. */
  fieldInk: string;
  /** Softer text on `field`. */
  fieldMuted: string;
  /** Text over dark photos / night scrims. */
  lightInk: string;
  /** Deep tone for dark scrims and night panels. */
  deep: string;
  /** Warm highlight for text over dark (night archetypes). */
  glow: string;
  scrimDark: Rgb;
  scrimLight: Rgb;
};

function luminanceOf(rgb: Rgb): number {
  const linear = (channel: number) => {
    const n = channel / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

export function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  return rgb ? luminanceOf(rgb) : 0.5;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export function normalizePosterHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return null;
}

/** Push `color` toward black or white until it reaches `minRatio` against `background`. */
export function ensureContrast(color: string, background: string, minRatio: number): string {
  if (contrastRatio(color, background) >= minRatio) return color;
  const target = relativeLuminance(background) > 0.4 ? BLACK : WHITE;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHexToward(color, target, step * 0.05);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return target === BLACK ? '#000000' : '#ffffff';
}

/** Whichever of the two inks reads better on `background`. */
export function readableOn(background: string, light = '#ffffff', dark = '#1f1a17'): string {
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
}

function secondaryFromAccent(accent: string): string {
  const rgb = parseHexRgb(accent);
  if (!rgb) return '#5a8f3c';
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // A friendly complementary-ish partner, kept mid-dark so it can carry text.
  return hslToHex((hsl.h + 110) % 360, Math.min(55, Math.max(35, hsl.s)), 38);
}

export function derivePosterPalette(input: {
  accent?: string | null;
  secondary?: string | null;
  field?: string | null;
}): PosterPalette {
  const rawAccent = normalizePosterHex(input.accent) ?? DEFAULT_POSTER_ACCENT;
  const baseField =
    normalizePosterHex(input.field) ??
    mixHexToward(mixHexToward(rawAccent, WARM_CREAM, 0.86), WHITE, 0.2);
  // Fields are paper: keep them light no matter what the model returned.
  const field =
    relativeLuminance(baseField) < 0.72 ? mixHexToward(baseField, WHITE, 0.78) : baseField;
  // The accent carries pills and icon strokes on the field, so it needs 3:1 there.
  const accent = ensureContrast(rawAccent, field, 3);
  const secondary = ensureContrast(
    normalizePosterHex(input.secondary) ?? secondaryFromAccent(accent),
    field,
    3
  );
  const fieldInk = ensureContrast(mixHexToward(accent, BLACK, 0.62), field, 7);
  const fieldMuted = ensureContrast(mixHexToward(accent, BLACK, 0.35), field, 4.5);
  const deep = mixHexToward(mixHexToward(accent, NIGHT_NAVY, 0.82), BLACK, 0.1);
  const glow = ensureContrast(mixHexToward(accent, { r: 240, g: 200, b: 130 }, 0.65), deep, 4.5);
  const deepRgb = parseHexRgb(deep) ?? NIGHT_NAVY;
  const fieldRgb = parseHexRgb(field) ?? WARM_CREAM;

  return {
    accent,
    onAccent: readableOn(accent, '#ffffff', fieldInk),
    secondary,
    onSecondary: readableOn(secondary, '#ffffff', fieldInk),
    field,
    fieldInk,
    fieldMuted,
    lightInk: mixHexToward(field, WHITE, 0.6),
    deep,
    glow,
    scrimDark: deepRgb,
    scrimLight: fieldRgb,
  };
}

export function rgba(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, Math.min(1, alpha))})`;
}
