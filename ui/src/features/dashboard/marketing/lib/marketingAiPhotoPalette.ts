import type { ShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';

import { resolveOrgBrandHex } from '@/lib/theme/brandColor';
import { clampChannel, hslToHex, parseHexRgb, rgbToHsl } from '@/lib/theme/colorConvert';

/** First Look template id per content type — property colors (photos, else brand). */
export const MARKETING_AI_PHOTO_PALETTE_SUGGESTION_IDS = {
  calendar: 'blush-petal',
  design: 'quiet-coast',
  video: 'slow-pans-soft-light',
} as const;

export type MarketingAiTokenPalette = {
  primary: string;
  secondary: string;
  accent: string;
};

export type MarketingAiCalendarPreviewPalette = {
  canvas: string;
  available: string;
  today: string;
  ink: string;
};

export type MarketingAiVideoMood = {
  from: string;
  to: string;
};

function parseHslComponents(hsl: string): { h: number; s: number; l: number } | null {
  const match = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(hsl.trim());
  if (!match) return null;
  return {
    h: Number(match[1]),
    s: Number(match[2]),
    l: Number(match[3]),
  };
}

function surfaceHslToHex(surfaceHsl: string, fallback: string): string {
  const parsed = parseHslComponents(surfaceHsl);
  if (!parsed) return fallback;
  return hslToHex(parsed.h, parsed.s, parsed.l);
}

/** Soften an accent toward a mid chip fill (calendar available days / design primary wash). */
function softAccentFill(accentHex: string): string {
  const rgb = parseHexRgb(accentHex);
  if (!rgb) return accentHex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hslToHex(hsl.h, clampChannel(hsl.s * 0.85, 28, 58), clampChannel(hsl.l + 14, 52, 68));
}

function inkFromSurface(surfaceHslDark: string, accentHex: string): string {
  const parsed = parseHslComponents(surfaceHslDark);
  if (parsed) {
    return hslToHex(
      parsed.h,
      clampChannel(parsed.s + 8, 18, 42),
      clampChannel(parsed.l + 8, 16, 28)
    );
  }
  const rgb = parseHexRgb(accentHex);
  if (!rgb) return '#2a241f';
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hslToHex(hsl.h, clampChannel(hsl.s * 0.55, 16, 40), 22);
}

/**
 * Accent hex for marketing defaults: property-photo palette when available, else org brand.
 * Same sampler as Public page editor → Styles → From photos.
 */
export function resolveMarketingAccentHex(
  brandColor: string | null | undefined,
  mediaPalette: ShowcaseMediaPalette | null | undefined
): string {
  const fromPhotos = mediaPalette?.accentHexLight?.trim();
  if (fromPhotos && /^#[0-9a-f]{6}$/i.test(fromPhotos)) {
    return fromPhotos;
  }
  return resolveOrgBrandHex(brandColor);
}

/** Soft cream canvas + mid fill + accent from a single accent hex (brand fallback). */
export function tokenPaletteFromAccentHex(accentHex: string): MarketingAiTokenPalette {
  const accent = resolveOrgBrandHex(accentHex);
  const rgb = parseHexRgb(accent);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : { h: 28, s: 80, l: 52 };
  const secondary = hslToHex(
    hsl.h,
    clampChannel(hsl.s * 0.22, 8, 28),
    clampChannel(Math.max(hsl.l, 88), 93, 98)
  );
  return {
    primary: softAccentFill(accent),
    secondary,
    accent,
  };
}

export function calendarPreviewPaletteFromAccentHex(
  accentHex: string
): MarketingAiCalendarPreviewPalette {
  const tokens = tokenPaletteFromAccentHex(accentHex);
  const rgb = parseHexRgb(tokens.accent);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : { h: 28, s: 40, l: 22 };
  return {
    canvas: tokens.secondary,
    available: tokens.primary,
    today: tokens.accent,
    ink: hslToHex(hsl.h, clampChannel(hsl.s * 0.55, 16, 40), 22),
  };
}

export function designPreviewPaletteFromAccentHex(accentHex: string): MarketingAiTokenPalette {
  return tokenPaletteFromAccentHex(accentHex);
}

export function videoMoodFromAccentHex(accentHex: string): MarketingAiVideoMood {
  const tokens = tokenPaletteFromAccentHex(accentHex);
  return { from: tokens.secondary, to: tokens.accent };
}

export type MarketingAiLookPresentation = {
  fromPhotos: boolean;
  title: string;
  summary: string;
  tokenPalette: MarketingAiTokenPalette;
  calendarPreview: MarketingAiCalendarPreviewPalette;
  designPreview: MarketingAiTokenPalette;
  videoMood: MarketingAiVideoMood;
};

/** First Look template: photos when available, else brand — same as blank/default accents. */
export function resolveMarketingAiLookPresentation(
  brandColor: string | null | undefined,
  mediaPalette: ShowcaseMediaPalette | null | undefined
): MarketingAiLookPresentation {
  const fromPhotos = Boolean(mediaPalette?.accentHexLight);
  if (mediaPalette && fromPhotos) {
    return {
      fromPhotos: true,
      title: 'Property colors',
      summary: 'From photos',
      tokenPalette: tokenPaletteFromMedia(mediaPalette),
      calendarPreview: calendarPreviewPaletteFromMedia(mediaPalette),
      designPreview: designPreviewPaletteFromMedia(mediaPalette),
      videoMood: videoMoodFromMedia(mediaPalette),
    };
  }
  const accent = resolveOrgBrandHex(brandColor);
  return {
    fromPhotos: false,
    title: 'Property colors',
    summary: 'Brand color',
    tokenPalette: tokenPaletteFromAccentHex(accent),
    calendarPreview: calendarPreviewPaletteFromAccentHex(accent),
    designPreview: designPreviewPaletteFromAccentHex(accent),
    videoMood: videoMoodFromAccentHex(accent),
  };
}

/**
 * Map showcase media palette → AI token palette (primary fill, secondary canvas, accent today/CTA).
 * Same sampler as Public page editor → Styles → From photos.
 */
export function tokenPaletteFromMedia(media: ShowcaseMediaPalette): MarketingAiTokenPalette {
  const secondary = surfaceHslToHex(media.surfaceHslLight, '#faf6f1');
  const primary = softAccentFill(media.accentHexLight);
  const accent = media.accentHexDark || media.accentHexLight;
  return { primary, secondary, accent };
}

export function calendarPreviewPaletteFromMedia(
  media: ShowcaseMediaPalette
): MarketingAiCalendarPreviewPalette {
  const tokens = tokenPaletteFromMedia(media);
  return {
    canvas: tokens.secondary,
    available: tokens.primary,
    today: tokens.accent,
    ink: inkFromSurface(media.surfaceHslDark, media.accentHexLight),
  };
}

export function designPreviewPaletteFromMedia(
  media: ShowcaseMediaPalette
): MarketingAiTokenPalette {
  return tokenPaletteFromMedia(media);
}

export function videoMoodFromMedia(media: ShowcaseMediaPalette): MarketingAiVideoMood {
  const tokens = tokenPaletteFromMedia(media);
  return {
    from: tokens.secondary,
    to: tokens.accent,
  };
}

export function isMarketingAiPhotoPaletteSuggestion(
  contentType: 'calendar' | 'design' | 'video',
  suggestionId: string
): boolean {
  return MARKETING_AI_PHOTO_PALETTE_SUGGESTION_IDS[contentType] === suggestionId;
}
