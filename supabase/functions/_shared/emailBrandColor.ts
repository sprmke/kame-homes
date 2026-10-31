import { DEFAULT_ORG_BRAND_COLOR } from './orgSettingsValidation.ts';

type Rgb = { r: number; g: number; b: number };

function parseHexColor(hex: string): Rgb | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!match) return null;
  const raw = match[1];
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function toHexColor({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function resolveBrandHex(brandColorHex?: string | null): string {
  const trimmed = brandColorHex?.trim();
  if (trimmed && parseHexColor(trimmed)) return trimmed;
  return DEFAULT_ORG_BRAND_COLOR;
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

function contrastRatio(left: Rgb, right: Rgb): number {
  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Same hex as the Brand color picker / admin `--primary` (not a darkened derivative).
 */
export function resolveEmailPrimaryHex(brandColorHex?: string | null): string {
  return resolveBrandHex(brandColorHex);
}

/** CTA / on-fill text — white, matching admin `--primary-foreground`. */
export function resolveEmailOnPrimaryHex(_brandColorHex?: string | null): string {
  return '#ffffff';
}

/**
 * Brand-tinted text safe on a white (or near-white) email surface.
 * Light brand colors (yellow, cream, pastel) are darkened until WCAG AA (~4.5:1).
 */
export function resolveEmailReadableOnWhiteHex(
  brandColorHex?: string | null,
  minRatio = 4.5
): string {
  const white: Rgb = { r: 255, g: 255, b: 255 };
  const inkFallback = '#0f172a';
  let current = resolveBrandHex(brandColorHex);
  let rgb = parseHexColor(current);
  if (!rgb) return inkFallback;

  if (contrastRatio(rgb, white) >= minRatio) return current;

  for (let i = 0; i < 48; i++) {
    rgb = {
      r: rgb.r * 0.9,
      g: rgb.g * 0.9,
      b: rgb.b * 0.9,
    };
    current = toHexColor(rgb);
    rgb = parseHexColor(current)!;
    if (contrastRatio(rgb, white) >= minRatio) return current;
  }

  return inkFallback;
}
