import {
  buildShowcaseBrandPalette,
  buildShowcaseDefaultInkTones,
  buildShowcasePaletteTones,
  showcaseInkCssVars,
  showcasePaletteToneCssVars,
  type ShowcasePaletteTones,
} from '@/features/guest/marketing/showcase/lib/showcaseBrandPalette';
import type { ShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';
import {
  getShowcasePresetPalette,
  isShowcasePresetPaletteId,
} from '@/features/guest/marketing/showcase/lib/showcasePresetPalettes';
import type { ShowcaseColorMode } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';
import type { ShowcasePaletteMode } from '@/features/guest/marketing/showcase/types/showcase';

export function usesShowcaseCustomPalette(paletteMode: ShowcasePaletteMode): boolean {
  return paletteMode !== 'default';
}

function resolvePaletteBaseHex(
  paletteMode: ShowcasePaletteMode,
  brandColor: string,
  mediaPalette: ShowcaseMediaPalette | null,
  customPaletteBase?: string | null,
  themeMode: ShowcaseColorMode = 'light'
): string | null {
  if (paletteMode === 'brand') return brandColor;
  if (paletteMode === 'custom') return customPaletteBase?.trim() || brandColor;
  if (isShowcasePresetPaletteId(paletteMode)) return getShowcasePresetPalette(paletteMode).baseHex;
  if (paletteMode === 'media' && mediaPalette) {
    return themeMode === 'dark' ? mediaPalette.accentHexDark : mediaPalette.accentHexLight;
  }
  return null;
}

/** Page/card background override; null = template default. */
export function resolveShowcasePaletteSurface(
  paletteMode: ShowcasePaletteMode,
  themeMode: ShowcaseColorMode,
  mediaPalette: ShowcaseMediaPalette | null,
  brandColor: string,
  customPaletteBase?: string | null
): string | null {
  if (paletteMode === 'default') return null;

  if (paletteMode === 'brand' || paletteMode === 'custom') {
    const base = paletteMode === 'custom' ? customPaletteBase?.trim() || brandColor : brandColor;
    const palette = buildShowcaseBrandPalette(base);
    return themeMode === 'dark' ? palette.surfaceHslDark : palette.surfaceHslLight;
  }

  if (isShowcasePresetPaletteId(paletteMode)) {
    const preset = getShowcasePresetPalette(paletteMode);
    return themeMode === 'dark' ? preset.surfaceHslDark : preset.surfaceHslLight;
  }

  if (paletteMode === 'media' && mediaPalette) {
    return themeMode === 'dark' ? mediaPalette.surfaceHslDark : mediaPalette.surfaceHslLight;
  }

  return null;
}

/** Accent color for the active palette + theme mode. */
export function resolveShowcasePaletteAccent(
  paletteMode: ShowcasePaletteMode,
  themeMode: ShowcaseColorMode,
  brandAccent: string,
  mediaPalette: ShowcaseMediaPalette | null,
  brandColor: string,
  customPaletteBase?: string | null
): string {
  if (paletteMode === 'brand' || paletteMode === 'custom') {
    const base = paletteMode === 'custom' ? customPaletteBase?.trim() || brandColor : brandColor;
    const palette = buildShowcaseBrandPalette(base);
    return themeMode === 'dark' ? palette.accentHexDark : palette.accentHexLight;
  }

  if (isShowcasePresetPaletteId(paletteMode)) {
    const preset = getShowcasePresetPalette(paletteMode);
    return themeMode === 'dark' ? preset.accentHexDark : preset.accentHexLight;
  }

  if (paletteMode === 'media' && mediaPalette) {
    return themeMode === 'dark' ? mediaPalette.accentHexDark : mediaPalette.accentHexLight;
  }

  return brandAccent;
}

/** Full tone scale for custom palettes; null when using template defaults. */
export function resolveShowcasePaletteTones(
  paletteMode: ShowcasePaletteMode,
  themeMode: ShowcaseColorMode,
  mediaPalette: ShowcaseMediaPalette | null,
  brandColor: string,
  customPaletteBase?: string | null
): ShowcasePaletteTones | null {
  if (paletteMode === 'default') return null;

  if (paletteMode === 'media' && mediaPalette) {
    const base = themeMode === 'dark' ? mediaPalette.accentHexDark : mediaPalette.accentHexLight;
    const tones = buildShowcasePaletteTones(base, themeMode);
    return {
      ...tones,
      surface: themeMode === 'dark' ? mediaPalette.surfaceHslDark : mediaPalette.surfaceHslLight,
    };
  }

  const base = resolvePaletteBaseHex(
    paletteMode,
    brandColor,
    mediaPalette,
    customPaletteBase,
    themeMode
  );
  if (!base) return null;
  return buildShowcasePaletteTones(base, themeMode);
}

export function resolveShowcasePaletteToneStyle(
  paletteMode: ShowcasePaletteMode,
  themeMode: ShowcaseColorMode,
  mediaPalette: ShowcaseMediaPalette | null,
  brandColor: string,
  customPaletteBase?: string | null
): Record<string, string> {
  const tones = resolveShowcasePaletteTones(
    paletteMode,
    themeMode,
    mediaPalette,
    brandColor,
    customPaletteBase
  );
  if (tones) return showcasePaletteToneCssVars(tones);
  // Default palette: keep template page bg classes, but always inject readable ink/border vars.
  return showcaseInkCssVars(buildShowcaseDefaultInkTones(themeMode));
}
