import {
  clampChannel,
  hslToHex,
  parseHexRgb,
  rgbToHsl as rgbChannelsToHsl,
  type Hsl,
  type Rgb,
} from '@/lib/theme/colorConvert';

/** WCAG AA for normal-size text. White labels sit on brand fills (buttons, badges, pills). */
export const WHITE_TEXT_MIN_CONTRAST = 4.5;

/**
 * Brand-coloured *text* on the light canvas (`--background`, 220 18% 97%).
 * Teal at the picker lightness is a fill colour; as 14-20px text it lands near 2.8:1.
 * 4.8 leaves headroom for text that sits on a `bg-primary/10` tint, not the canvas.
 */
export const BRAND_TEXT_MIN_CONTRAST = 4.8;

/** `--background` in the light theme (`hsl(220 18% 97%)`). */
const LIGHT_CANVAS_LUMINANCE = 0.9247;

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio of white text on `hsl(h s% l%)`. */
export function whiteTextContrast(h: number, s: number, l: number): number {
  const rgb = parseHexRgb(hslToHex(h, s, l));
  if (!rgb) return 1;
  return 1.05 / (relativeLuminance(rgb) + 0.05);
}

/**
 * Highest whole lightness ≤ `l` (same hue/saturation) where white text reaches
 * {@link WHITE_TEXT_MIN_CONTRAST}. Whole numbers because theme tokens are emitted rounded.
 */
export function textSafeLightness(h: number, s: number, l: number): number {
  const hR = Math.round(h);
  const sR = Math.round(s);
  let safe = Math.round(l);
  while (safe > 0 && whiteTextContrast(hR, sR, safe) < WHITE_TEXT_MIN_CONTRAST) safe -= 1;
  return Math.max(safe, 0);
}

/** Lowest lightness at which `hsl(h s% l%)` text reaches AA on the light canvas. */
export function textInkLightness(h: number, s: number, l: number): number {
  const hR = Math.round(h);
  const sR = Math.round(s);
  let safe = Math.round(l);
  const contrastAt = (lightness: number) => {
    const rgb = parseHexRgb(hslToHex(hR, sR, lightness));
    if (!rgb) return 1;
    const textLuminance = relativeLuminance(rgb);
    const [hi, lo] = [LIGHT_CANVAS_LUMINANCE, textLuminance].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  };
  while (safe > 0 && contrastAt(safe) < BRAND_TEXT_MIN_CONTRAST) safe -= 1;
  return Math.max(safe, 0);
}

/** Teal green — matches `--sidebar-primary` (`168 65% 40%`) in index.css. */
export const DEFAULT_ORG_BRAND_COLOR = '#24a88e';

function parseHexColor(hex: string): Rgb | null {
  return parseHexRgb(hex);
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  return rgbChannelsToHsl(r, g, b);
}

function clamp(value: number, min: number, max: number): number {
  return clampChannel(value, min, max);
}

function shiftHue(h: number, delta: number): number {
  return (((h + delta) % 360) + 360) % 360;
}

function hslString({ h, s, l }: Hsl): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

/**
 * Button/CTA sheen with white labels: the lightest stop (`l + 4`) must stay text-safe,
 * so light brand colors shift the whole sheen darker.
 */
export function buildTextSafeBrandGradientCss(h: number, s: number, l: number): string {
  const safeBase = Math.min(Math.round(l), textSafeLightness(h, s, Math.round(l) + 4) - 4);
  return buildBrandGradientCss(h, s, safeBase);
}

/** 3-stop 135° sheen around the selected color — same hue/saturation, slight lightness steps. */
export function buildBrandGradientCss(h: number, s: number, l: number): string {
  const brandS = Math.round(clamp(s, 0, 100));
  const hR = Math.round(h);
  const l1 = Math.round(clamp(l + 4, 0, 100));
  const l2 = Math.round(clamp(l, 0, 100));
  const l3 = Math.round(clamp(l - 5, 0, 100));
  return `linear-gradient(135deg, hsl(${hR} ${brandS}% ${l1}%) 0%, hsl(${hR} ${brandS}% ${l2}%) 45%, hsl(${hR} ${brandS}% ${l3}%) 100%)`;
}

export function hexToHslComponents(hex: string): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hexToHslComponents(DEFAULT_ORG_BRAND_COLOR);
  return hslString(rgbToHsl(rgb));
}

/** Lighter → darker HSL stops for mode-switch SVG gradient overlay. */
export function brandTransitionGradientStops(
  brandColor: string | null | undefined,
  isDark: boolean
): { from: string; to: string } {
  const theme = buildDashboardBrandStyle(brandColor, isDark);
  return {
    from: `hsl(${theme['--gradient-primary-from']!})`,
    to: `hsl(${theme['--gradient-primary-to']!})`,
  };
}

/** Read gradient stops already applied on `:root` (admin shell, guest brand shell). */
export function readCssBrandGradientStops(): { from: string; to: string } | null {
  if (typeof document === 'undefined') return null;

  const style = getComputedStyle(document.documentElement);
  const from = style.getPropertyValue('--gradient-primary-from').trim();
  const to = style.getPropertyValue('--gradient-primary-to').trim();
  if (!from || !to) return null;

  return { from: `hsl(${from})`, to: `hsl(${to})` };
}

/** Context hex → applied CSS vars → platform default. */
export function resolveBrandTransitionGradientStops(
  brandColor: string | null | undefined,
  isDark: boolean
): { from: string; to: string } {
  const trimmed = brandColor?.trim();
  if (trimmed && parseHexColor(trimmed)) {
    return brandTransitionGradientStops(trimmed, isDark);
  }

  const cssStops = readCssBrandGradientStops();
  if (cssStops) return cssStops;

  return brandTransitionGradientStops(null, isDark);
}

/**
 * Mode-switch overlay wordmark. "Kame" stays white on the brand fill. "Homes"
 * uses a complementary pastel tint for a two-tone lockup.
 */
export function resolveBrandWordmarkTextColors(
  brandColor: string | null | undefined,
  isDark: boolean
): { primary: string; accent: string } {
  const hex = resolveOrgBrandHex(brandColor);
  const rgb = parseHexColor(hex) ?? parseHexColor(DEFAULT_ORG_BRAND_COLOR)!;
  const { h, s } = rgbToHsl(rgb);

  const accentHue = shiftHue(h, -49);
  const accentS = clamp(s * 0.6, 40, 70);
  const accentL = isDark ? 86 : 90;

  return {
    primary: 'hsl(0 0% 100%)',
    accent: `hsl(${Math.round(accentHue)} ${Math.round(accentS)}% ${accentL}%)`,
  };
}

export function resolveOrgBrandHex(brandColor: string | null | undefined): string {
  const trimmed = brandColor?.trim();
  if (trimmed && parseHexColor(trimmed)) return trimmed;
  return DEFAULT_ORG_BRAND_COLOR;
}

/** @deprecated Alias for resolveOrgBrandHex */
export const resolveGuestBrandHex = resolveOrgBrandHex;

export function isDefaultOrgBrandColor(brandColor: string | null | undefined): boolean {
  return resolveOrgBrandHex(brandColor).toLowerCase() === DEFAULT_ORG_BRAND_COLOR.toLowerCase();
}

/** Property settings form value — show inherited org color when no property override is stored. */
export function propertyBrandColorFormValue(
  stored: string | null | undefined,
  resolvedBrandColor: string
): string {
  const trimmed = stored?.trim() ?? '';
  return trimmed || resolveOrgBrandHex(resolvedBrandColor);
}

/** DB patch value — empty string clears property override (inherit org). */
export function propertyBrandColorStoredValue(
  draftColor: string,
  resolvedBrandColor: string
): string {
  const trimmed = draftColor.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === resolveOrgBrandHex(resolvedBrandColor).toLowerCase()) {
    return '';
  }
  return trimmed;
}

export function propertyBrandColorsEquivalent(
  left: string,
  right: string,
  resolvedBrandColor: string
): boolean {
  return (
    propertyBrandColorStoredValue(left, resolvedBrandColor).toLowerCase() ===
    propertyBrandColorStoredValue(right, resolvedBrandColor).toLowerCase()
  );
}

/** Fallback dashboard theme when hex parsing fails (teal primary). */
const DEFAULT_LIGHT_THEME: Record<string, string> = {
  '--primary': '168 65% 40%',
  '--primary-foreground': '0 0% 100%',
  '--primary-strong': '168 65% 31%',
  '--brand-ink': '168 65% 26%',
  '--ring': '168 65% 40%',
  '--success': '168 65% 40%',
  '--info': '168 65% 46%',
  '--glow-color': '168 65% 40%',
  '--sidebar-primary': '168 65% 40%',
  '--sidebar-primary-foreground': '0 0% 100%',
  '--sidebar-ring': '168 65% 40%',
  '--chart-1': '168 65% 40%',
  '--chart-2': '168 65% 50%',
  '--gradient-primary-from': '168 65% 46%',
  '--gradient-primary-to': '168 65% 38%',
  '--gradient-primary-mid': '168 65% 42%',
  '--mesh-a': '168 65% 40%',
  '--mesh-b': '168 65% 50%',
  '--brand-highlight': '168 65% 46%',
  '--brand-highlight-end': '168 65% 40%',
  '--brand-range-bg-start': '168 55% 92%',
  '--brand-range-bg-end': '168 50% 88%',
  '--brand-range-fg': '168 65% 28%',
  '--brand-gradient':
    'linear-gradient(135deg, hsl(168 65% 31%) 0%, hsl(168 65% 27%) 45%, hsl(168 65% 22%) 100%)',
};

const DEFAULT_DARK_THEME: Record<string, string> = {
  '--primary': '168 65% 45%',
  '--primary-foreground': '0 0% 100%',
  '--primary-strong': '168 65% 31%',
  '--brand-ink': '168 65% 60%',
  '--ring': '168 65% 45%',
  '--success': '168 65% 45%',
  '--info': '168 65% 50%',
  '--glow-color': '168 65% 45%',
  '--sidebar-primary': '168 65% 45%',
  '--sidebar-primary-foreground': '0 0% 100%',
  '--sidebar-ring': '168 65% 45%',
  '--chart-1': '168 65% 45%',
  '--chart-2': '168 65% 55%',
  '--gradient-primary-from': '168 65% 50%',
  '--gradient-primary-to': '168 65% 42%',
  '--gradient-primary-mid': '168 65% 46%',
  '--mesh-a': '168 65% 45%',
  '--mesh-b': '168 65% 55%',
  '--brand-highlight': '168 65% 50%',
  '--brand-highlight-end': '168 65% 45%',
  '--brand-range-bg-start': '168 40% 18%',
  '--brand-range-bg-end': '168 35% 14%',
  '--brand-range-fg': '168 65% 72%',
  '--brand-gradient':
    'linear-gradient(135deg, hsl(168 65% 31%) 0%, hsl(168 65% 27%) 45%, hsl(168 65% 22%) 100%)',
};

/** Tokens use the picker hex as `--primary`; labels on fills stay white. */
function generateBrandTheme(hex: string, isDark: boolean): Record<string, string> {
  const rgb = parseHexColor(hex)!;
  const { h, s, l } = rgbToHsl(rgb);
  const primary = hslString({ h, s, l });
  const primaryFg = '0 0% 100%';
  const primaryStrong = hslString({ h, s, l: textSafeLightness(h, s, l) });
  // On dark themes the canvas is dark, so brand ink is a lighter step of the same hue.
  const brandInk = hslString({
    h,
    s,
    l: isDark ? clamp(l + 15, 0, 88) : textInkLightness(h, s, l),
  });
  const brandGradient = buildTextSafeBrandGradientCss(h, s, l);
  const gradientFrom = hslString({ h, s, l: clamp(l + 4, 0, 100) });
  const gradientMid = primary;
  const gradientTo = hslString({ h, s, l: clamp(l - 5, 0, 100) });

  const infoL = clamp(l + 6, 0, 92);
  const chart2L = clamp(l + 10, 0, 92);
  const meshB = hslString({
    h,
    s: clamp(s * 0.75, 20, 90),
    l: clamp(l + 8, 0, 92),
  });

  const rangeBgStart = hslString({
    h,
    s: clamp(s * 0.45, 20, 60),
    l: isDark ? 18 : 92,
  });
  const rangeBgEnd = hslString({
    h,
    s: clamp(s * 0.4, 18, 55),
    l: isDark ? 14 : 88,
  });
  const rangeFg = hslString({
    h,
    s: clamp(s, 35, 80),
    l: isDark ? 72 : 28,
  });

  return {
    '--primary': primary,
    '--primary-foreground': primaryFg,
    '--primary-strong': primaryStrong,
    '--brand-ink': brandInk,
    '--ring': primary,
    '--success': primary,
    '--info': hslString({ h, s, l: infoL }),
    '--glow-color': primary,
    '--sidebar-primary': primary,
    '--sidebar-primary-foreground': primaryFg,
    '--sidebar-ring': primary,
    '--chart-1': primary,
    '--chart-2': hslString({ h, s: clamp(s * 0.85, 20, 90), l: chart2L }),
    '--gradient-primary-from': gradientFrom,
    '--gradient-primary-to': gradientTo,
    '--gradient-primary-mid': gradientMid,
    '--brand-gradient': brandGradient,
    '--mesh-a': primary,
    '--mesh-b': meshB,
    '--brand-highlight': gradientFrom,
    '--brand-highlight-end': gradientTo,
    '--brand-range-bg-start': rangeBgStart,
    '--brand-range-bg-end': rangeBgEnd,
    '--brand-range-fg': rangeFg,
  };
}

/** Full admin dashboard theme from org brand color. */
export function buildDashboardBrandStyle(
  brandColor: string | null | undefined,
  isDark: boolean
): Record<string, string> {
  const hex = resolveOrgBrandHex(brandColor);
  if (!parseHexColor(hex)) {
    return isDark ? { ...DEFAULT_DARK_THEME } : { ...DEFAULT_LIGHT_THEME };
  }
  return generateBrandTheme(hex, isDark);
}

/** CSS custom properties scoped to guest-facing shells. */
export function buildGuestBrandStyle(
  brandColor: string | null | undefined,
  isDark: boolean
): Record<string, string> {
  const theme = buildDashboardBrandStyle(brandColor, isDark);
  return {
    '--primary': theme['--primary']!,
    '--primary-foreground': theme['--primary-foreground']!,
    '--primary-strong': theme['--primary-strong']!,
    '--ring': theme['--ring']!,
    '--success': theme['--success']!,
    '--glow-color': theme['--glow-color']!,
    '--gradient-primary-from': theme['--gradient-primary-from']!,
    '--gradient-primary-to': theme['--gradient-primary-to']!,
    '--gradient-primary-mid': theme['--gradient-primary-mid']!,
    '--brand-gradient': theme['--brand-gradient']!,
    '--mesh-a': theme['--mesh-a']!,
    '--mesh-b': theme['--mesh-b']!,
    '--brand-highlight': theme['--brand-highlight']!,
    '--brand-highlight-end': theme['--brand-highlight-end']!,
  };
}
