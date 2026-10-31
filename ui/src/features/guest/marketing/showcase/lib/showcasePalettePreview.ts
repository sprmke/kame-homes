import { buildShowcaseBrandPalette } from '@/features/guest/marketing/showcase/lib/showcaseBrandPalette';
import type { ShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';
import {
  getShowcasePresetPalette,
  isShowcasePresetPaletteId,
} from '@/features/guest/marketing/showcase/lib/showcasePresetPalettes';
import type { ShowcasePaletteMode } from '@/features/guest/marketing/showcase/types/showcase';

import { DEFAULT_ORG_BRAND_COLOR, resolveOrgBrandHex } from '@/lib/theme/brandColor';

const MEDIA_PLACEHOLDER_SWATCH = [
  'hsl(34 22% 94%)',
  'hsl(32 16% 22%)',
  '#B8895A',
  '#D4A574',
] as const;

function hslSurface(hsl: string): string {
  return `hsl(${hsl})`;
}

function swatchFromSurfacesAndAccents(
  surfaceHslLight: string,
  surfaceHslDark: string,
  accentHexLight: string,
  accentHexDark: string
): string[] {
  return [hslSurface(surfaceHslLight), hslSurface(surfaceHslDark), accentHexLight, accentHexDark];
}

/** Four-color swatch for editor dropdowns (light surface, dark surface, light accent, dark accent). */
export function resolvePaletteModeSwatchColors(
  mode: ShowcasePaletteMode,
  brandColor: string | null | undefined,
  mediaPalette: ShowcaseMediaPalette | null,
  customPaletteBase?: string | null
): string[] {
  const brandHex = resolveOrgBrandHex(brandColor ?? DEFAULT_ORG_BRAND_COLOR);

  if (mode === 'default') {
    return ['hsl(0 0% 99%)', 'hsl(220 14% 96%)', 'hsl(224 14% 16%)', brandHex];
  }

  if (mode === 'brand') {
    const palette = buildShowcaseBrandPalette(brandColor ?? DEFAULT_ORG_BRAND_COLOR);
    return swatchFromSurfacesAndAccents(
      palette.surfaceHslLight,
      palette.surfaceHslDark,
      palette.accentHexLight,
      palette.accentHexDark
    );
  }

  if (mode === 'custom') {
    const base = customPaletteBase?.trim() || brandColor || DEFAULT_ORG_BRAND_COLOR;
    const palette = buildShowcaseBrandPalette(base);
    return swatchFromSurfacesAndAccents(
      palette.surfaceHslLight,
      palette.surfaceHslDark,
      palette.accentHexLight,
      palette.accentHexDark
    );
  }

  if (mode === 'media') {
    if (mediaPalette) {
      return swatchFromSurfacesAndAccents(
        mediaPalette.surfaceHslLight,
        mediaPalette.surfaceHslDark,
        mediaPalette.accentHexLight,
        mediaPalette.accentHexDark
      );
    }
    return [...MEDIA_PLACEHOLDER_SWATCH];
  }

  if (isShowcasePresetPaletteId(mode)) {
    const preset = getShowcasePresetPalette(mode);
    return swatchFromSurfacesAndAccents(
      preset.surfaceHslLight,
      preset.surfaceHslDark,
      preset.accentHexLight,
      preset.accentHexDark
    );
  }

  return ['hsl(0 0% 99%)', 'hsl(220 14% 96%)', 'hsl(224 14% 16%)', brandHex];
}

export function resolveAccentOptionPreview(
  accent: 'brand' | 'custom',
  brandColor: string | null | undefined,
  customAccent: string | null | undefined
): string {
  if (accent === 'custom') {
    const trimmed = customAccent?.trim();
    if (trimmed && /^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
    return '#2a9d8f';
  }
  return resolveOrgBrandHex(brandColor ?? DEFAULT_ORG_BRAND_COLOR);
}
