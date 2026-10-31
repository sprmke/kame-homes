import { hexToHslComponents, resolveOrgBrandHex } from '@/lib/theme/brandColor';
import { clampChannel, hslToHex } from '@/lib/theme/colorConvert';

export type ShowcaseBrandPalette = {
  surfaceHslLight: string;
  surfaceHslDark: string;
  accentHexLight: string;
  accentHexDark: string;
};

/** Full tonal scale for readable, palette-blended UI (not pure white/black). */
export type ShowcasePaletteTones = {
  surface: string;
  surfaceElevated: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  border: string;
  borderStrong: string;
  accent: string;
  onAccent: string;
  surfaceIsDark: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return clampChannel(value, min, max);
}

function hslComponents(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%`;
}

/** Parse property/org brand color (hex or hsl(...)) to HSL components. */
export function parseBrandColorHsl(brandColor: string): { h: number; s: number; l: number } {
  const trimmed = brandColor.trim();
  const hslMatch = trimmed.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    return {
      h: Number(hslMatch[1]),
      s: Number(hslMatch[2]),
      l: Number(hslMatch[3]),
    };
  }

  const components = hexToHslComponents(resolveOrgBrandHex(trimmed));
  const parts = components.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (parts) {
    return { h: Number(parts[1]), s: Number(parts[2]), l: Number(parts[3]) };
  }

  return { h: 168, s: 65, l: 40 };
}

/**
 * Derive showcase surface + accent pairs from the property brand color.
 * Light surfaces are a soft tint of the brand hue; dark surfaces are a deep shade (not pure black).
 */
export function buildShowcaseBrandPalette(brandColor: string): ShowcaseBrandPalette {
  const { h, s, l } = parseBrandColorHsl(brandColor);
  const hue = Math.round(h);

  const surfaceLightS = clamp(s * 0.32, 10, 28);
  const surfaceLightL = clamp(97 - (100 - l) * 0.06, 94, 98);
  const surfaceDarkS = clamp(s * 0.38, 12, 28);
  const surfaceDarkL = clamp(Math.max(l * 0.22, 12), 12, 20);

  const accentS = clamp(s, 34, 72);
  const accentLightL = clamp(l - 2, 34, 48);
  const accentDarkL = clamp(l + 10, 50, 64);

  return {
    surfaceHslLight: hslComponents(hue, surfaceLightS, surfaceLightL),
    surfaceHslDark: hslComponents(hue, surfaceDarkS, surfaceDarkL),
    accentHexLight: hslToHex(hue, accentS, accentLightL),
    accentHexDark: hslToHex(hue, accentS, accentDarkL),
  };
}

/**
 * Full readable tone scale for the active surface (light or dark).
 * Ink/border stay hue-tinted — soft cream / soft charcoal, never #fff / #000.
 */
export function buildShowcasePaletteTones(
  brandColor: string,
  themeMode: 'light' | 'dark'
): ShowcasePaletteTones {
  const base = buildShowcaseBrandPalette(brandColor);
  const { h, s } = parseBrandColorHsl(brandColor);
  const hue = Math.round(h);
  const chroma = clamp(s * 0.28, 8, 22);
  const surfaceIsDark = themeMode === 'dark';
  const surface = surfaceIsDark ? base.surfaceHslDark : base.surfaceHslLight;
  const accent = surfaceIsDark ? base.accentHexDark : base.accentHexLight;

  if (surfaceIsDark) {
    return {
      surface,
      surfaceElevated: hslComponents(hue, chroma + 2, 22),
      // Soft cream ink — readable on deep surfaces, not pure white
      ink: hslComponents(hue, Math.max(chroma - 4, 6), 90),
      inkMuted: hslComponents(hue, chroma, 78),
      inkFaint: hslComponents(hue, chroma + 2, 68),
      border: hslComponents(hue, chroma + 4, 34),
      borderStrong: hslComponents(hue, chroma + 6, 44),
      accent,
      onAccent: hslComponents(hue, chroma, 14),
      surfaceIsDark: true,
    };
  }

  return {
    surface,
    surfaceElevated: hslComponents(hue, Math.max(chroma - 2, 6), 99),
    // Soft charcoal ink — not pure black
    ink: hslComponents(hue, chroma + 4, 20),
    inkMuted: hslComponents(hue, chroma + 2, 40),
    inkFaint: hslComponents(hue, chroma, 50),
    border: hslComponents(hue, chroma, 82),
    borderStrong: hslComponents(hue, chroma + 2, 72),
    accent,
    onAccent: hslComponents(hue, Math.max(chroma - 4, 4), 97),
    surfaceIsDark: false,
  };
}

/**
 * Soft semantic ink for template **Default** palette.
 * Showcase does not use Tailwind `dark:` — without these vars, `text-muted-foreground`
 * inherits the dashboard light theme and becomes unreadable on dark template pages.
 */
export function buildShowcaseDefaultInkTones(themeMode: 'light' | 'dark'): ShowcasePaletteTones {
  if (themeMode === 'dark') {
    return {
      surface: '30 8% 12%',
      surfaceElevated: '30 7% 17%',
      ink: '40 14% 91%',
      inkMuted: '35 10% 76%',
      inkFaint: '32 8% 64%',
      border: '30 8% 30%',
      borderStrong: '32 9% 40%',
      accent: '#c4b5a0',
      onAccent: '30 10% 14%',
      surfaceIsDark: true,
    };
  }

  return {
    surface: '40 20% 97%',
    surfaceElevated: '40 18% 99%',
    ink: '30 10% 18%',
    inkMuted: '28 8% 40%',
    inkFaint: '26 6% 50%',
    border: '30 10% 84%',
    borderStrong: '28 8% 72%',
    accent: '#5c5348',
    onAccent: '40 20% 97%',
    surfaceIsDark: false,
  };
}

/** Semantic ink/border CSS vars (does not paint page background via inline style). */
export function showcaseInkCssVars(tones: ShowcasePaletteTones): Record<string, string> {
  return {
    '--background': tones.surface,
    '--card': tones.surfaceElevated,
    '--popover': tones.surfaceElevated,
    '--foreground': tones.ink,
    '--card-foreground': tones.ink,
    '--popover-foreground': tones.ink,
    '--muted': tones.surfaceElevated,
    '--muted-foreground': tones.inkMuted,
    '--secondary': tones.surfaceElevated,
    '--secondary-foreground': tones.ink,
    '--accent': tones.surfaceElevated,
    '--accent-foreground': tones.ink,
    '--border': tones.border,
    '--input': tones.border,
    '--ring': tones.borderStrong,
    '--showcase-surface': tones.surface,
    '--showcase-surface-elevated': tones.surfaceElevated,
    '--showcase-ink': tones.ink,
    '--showcase-ink-muted': tones.inkMuted,
    '--showcase-ink-faint': tones.inkFaint,
    '--showcase-border': tones.border,
    '--showcase-border-strong': tones.borderStrong,
    '--showcase-on-accent': tones.onAccent,
  };
}

/** Full surface + ink map when a custom/brand/preset/media palette is active. */
export function showcasePaletteToneCssVars(tones: ShowcasePaletteTones): Record<string, string> {
  return {
    ...showcaseInkCssVars(tones),
    backgroundColor: `hsl(${tones.surface})`,
    color: `hsl(${tones.ink})`,
  };
}
