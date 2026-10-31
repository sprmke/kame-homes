import {
  buildShowcaseBrandPalette,
  parseBrandColorHsl,
} from '@/features/guest/marketing/showcase/lib/showcaseBrandPalette';

import {
  BRAND_COLOR_PRESETS,
  type BrandColorPresetId,
  isBrandColorPresetId,
} from '@/lib/theme/brandColorPresets';

export const SHOWCASE_PRESET_PALETTE_IDS = BRAND_COLOR_PRESETS.map((preset) => preset.id);

export type ShowcasePresetPaletteId = BrandColorPresetId;

/** Legacy curated ids → brand-color preset ids (saved configs). */
const LEGACY_PRESET_PALETTE_IDS: Record<string, ShowcasePresetPaletteId> = {
  warm: 'amber',
  ocean: 'teal',
  blush: 'rose',
  forest: 'emerald',
  slate: 'indigo',
  dusk: 'violet',
};

export type ShowcasePresetPalette = {
  id: ShowcasePresetPaletteId;
  label: string;
  /** Source hex from property brand color presets. */
  baseHex: string;
  surfaceHslLight: string;
  surfaceHslDark: string;
  accentHexLight: string;
  accentHexDark: string;
  /** Sepia wash on light surfaces for warm hues. */
  warmTint: boolean;
};

function isWarmHue(hue: number): boolean {
  return hue <= 55 || hue >= 295;
}

function buildShowcasePresetPalette(
  id: ShowcasePresetPaletteId,
  label: string,
  baseHex: string
): ShowcasePresetPalette {
  const derived = buildShowcaseBrandPalette(baseHex);
  const { h } = parseBrandColorHsl(baseHex);
  return {
    id,
    label,
    baseHex,
    surfaceHslLight: derived.surfaceHslLight,
    surfaceHslDark: derived.surfaceHslDark,
    accentHexLight: derived.accentHexLight,
    accentHexDark: derived.accentHexDark,
    warmTint: isWarmHue(h),
  };
}

/** Curated showcase palettes — same hues as property Brand color settings. */
export const SHOWCASE_PRESET_PALETTES: Record<ShowcasePresetPaletteId, ShowcasePresetPalette> =
  Object.fromEntries(
    BRAND_COLOR_PRESETS.map((preset) => [
      preset.id,
      buildShowcasePresetPalette(preset.id, preset.label, preset.hex),
    ])
  ) as Record<ShowcasePresetPaletteId, ShowcasePresetPalette>;

export const SHOWCASE_PRESET_PALETTE_LIST = SHOWCASE_PRESET_PALETTE_IDS.map(
  (id) => SHOWCASE_PRESET_PALETTES[id]
);

export function normalizeShowcasePresetPaletteId(value: unknown): ShowcasePresetPaletteId | null {
  if (isShowcasePresetPaletteId(value)) return value;
  if (typeof value === 'string' && value in LEGACY_PRESET_PALETTE_IDS) {
    return LEGACY_PRESET_PALETTE_IDS[value]!;
  }
  return null;
}

export function isShowcasePresetPaletteId(value: unknown): value is ShowcasePresetPaletteId {
  return isBrandColorPresetId(value);
}

export function getShowcasePresetPalette(id: ShowcasePresetPaletteId): ShowcasePresetPalette {
  return SHOWCASE_PRESET_PALETTES[id];
}

/** Preset, brand, custom, and from-photos modes ship their own accent. */
export function showcasePaletteHasOwnAccent(mode: string): boolean {
  return (
    mode === 'brand' || mode === 'media' || mode === 'custom' || isShowcasePresetPaletteId(mode)
  );
}
