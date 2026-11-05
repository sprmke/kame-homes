import { mixHexToward, parseHexRgb, rgbChannelsToHex, type Rgb } from '@/lib/theme/colorConvert';

/**
 * Color primitives for marketing themes: CSS color parsing that round-trips the
 * original notation, WCAG contrast helpers, and OKLab/OKLCh for perceptual remaps.
 */

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export type ColorNotation = 'hex3' | 'hex6' | 'hex8' | 'rgb' | 'rgba';

export type ParsedColor = Rgb & { a: number; notation: ColorNotation };

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i;

/** Parses a whole-string CSS color (`#abc`, `#aabbcc`, `#aabbccdd`, `rgb()`, `rgba()`). */
export function parseCssColor(value: string): ParsedColor | null {
  const trimmed = value.trim();
  const hex = HEX_RE.exec(trimmed);
  if (hex) {
    const raw = hex[1]!;
    if (raw.length === 3) {
      const [r, g, b] = raw.split('').map((c) => Number.parseInt(c + c, 16)) as [
        number,
        number,
        number,
      ];
      return { r, g, b, a: 1, notation: 'hex3' };
    }
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    if (raw.length === 8) {
      return { r, g, b, a: Number.parseInt(raw.slice(6, 8), 16) / 255, notation: 'hex8' };
    }
    return { r, g, b, a: 1, notation: 'hex6' };
  }
  const rgb = RGB_RE.exec(trimmed);
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (channels.some((c) => c > 255)) return null;
    const alpha = rgb[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(rgb[4])));
    return {
      r: channels[0]!,
      g: channels[1]!,
      b: channels[2]!,
      a: alpha,
      notation: rgb[4] === undefined ? 'rgb' : 'rgba',
    };
  }
  return null;
}

/** Formats a color back in its source notation (hex3 widens to hex6). */
export function formatCssColor(color: Rgb & { a: number }, notation: ColorNotation): string {
  const hex = rgbChannelsToHex(color.r, color.g, color.b);
  if (notation === 'hex3' || notation === 'hex6') return hex;
  if (notation === 'hex8') {
    const alpha = Math.round(Math.max(0, Math.min(1, color.a)) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${hex}${alpha}`;
  }
  const [r, g, b] = [color.r, color.g, color.b].map((c) => Math.round(c));
  if (notation === 'rgb') return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${Number(color.a.toFixed(3))})`;
}

/** `#rrggbb` lowercase, or null. Accepts `#abc` and bare `aabbcc`. */
export function normalizeThemeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const candidate = /^[0-9a-f]{6}$/i.test(trimmed) ? `#${trimmed}` : trimmed;
  const parsed = parseCssColor(candidate);
  if (!parsed || parsed.notation === 'rgb' || parsed.notation === 'rgba') return null;
  if (parsed.notation === 'hex8') return null;
  return rgbChannelsToHex(parsed.r, parsed.g, parsed.b);
}

// ── WCAG contrast ────────────────────────────────────────────────────────────

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

/**
 * Push `color` away from the background's luminance until it reaches `minRatio`.
 * A light background needs darker ink and vice versa; picking the target from the
 * background (not the text) is what lets a mid-tone fill reach AA at all.
 */
export function ensureContrast(color: string, background: string, minRatio: number): string {
  if (contrastRatio(color, background) >= minRatio) return color;
  const backgroundLuminance = relativeLuminance(background);
  // 0.18 is the luminance at which white text reaches 4.5:1.
  const target = backgroundLuminance > 0.18 ? BLACK : WHITE;
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

export function mixTowardWhite(hex: string, weight: number): string {
  return mixHexToward(hex, WHITE, weight);
}

export function mixTowardBlack(hex: string, weight: number): string {
  return mixHexToward(hex, BLACK, weight);
}

/** Linear mix of two hexes (`weight` = share of `b`). */
export function mixHexes(a: string, b: string, weight: number): string {
  const target = parseHexRgb(b);
  return target ? mixHexToward(a, target, weight) : a;
}

// ── OKLab / OKLCh ────────────────────────────────────────────────────────────

export type Oklch = { L: number; C: number; h: number };

const toLinear = (c: number) => {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
};
const fromLinear = (n: number) =>
  (n <= 0.0031308 ? 12.92 * n : 1.055 * Math.pow(n, 1 / 2.4) - 0.055) * 255;

export function rgbToOklab({ r, g, b }: Rgb): { L: number; a: number; b: number } {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const { L, a, b } = rgbToOklab(rgb);
  const C = Math.sqrt(a * a + b * b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, h };
}

/** OKLCh → sRGB, reducing chroma until the color is in gamut (keeps L and h). */
export function oklchToRgb({ L, C, h }: Oklch): Rgb {
  const lightness = Math.max(0, Math.min(1, L));
  const rad = (h * Math.PI) / 180;
  const inGamut = (chroma: number) => {
    const lin = oklabToLinearRgb(lightness, chroma * Math.cos(rad), chroma * Math.sin(rad));
    return lin.every((c) => c >= -0.0005 && c <= 1.0005) ? lin : null;
  };
  let lin = inGamut(C);
  if (!lin) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 18; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(mid)) lo = mid;
      else hi = mid;
    }
    lin = inGamut(lo) ?? oklabToLinearRgb(lightness, 0, 0);
  }
  const [r, g, b] = lin.map((c) => Math.max(0, Math.min(255, fromLinear(Math.max(0, c)))));
  return { r: r!, g: g!, b: b! };
}
