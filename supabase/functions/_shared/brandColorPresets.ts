/** Mirror of ui/src/lib/theme/brandColorPresets.ts — keep in sync for edge validation. */

export const BRAND_COLOR_PRESET_IDS = [
  'coral',
  'amber',
  'lime',
  'emerald',
  'teal',
  'sky',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
  'rose',
] as const;

export type BrandColorPresetId = (typeof BRAND_COLOR_PRESET_IDS)[number];

/** Legacy showcase curated ids → brand-color preset ids. */
export const LEGACY_SHOWCASE_PRESET_PALETTE_IDS: Record<string, BrandColorPresetId> = {
  warm: 'amber',
  ocean: 'teal',
  blush: 'rose',
  forest: 'emerald',
  slate: 'indigo',
  dusk: 'violet',
};

export function normalizeShowcaseCuratedPaletteId(mode: unknown): BrandColorPresetId | null {
  if (typeof mode !== 'string') return null;
  if ((BRAND_COLOR_PRESET_IDS as readonly string[]).includes(mode)) {
    return mode as BrandColorPresetId;
  }
  return LEGACY_SHOWCASE_PRESET_PALETTE_IDS[mode] ?? null;
}

export function isShowcaseCuratedPaletteId(mode: unknown): mode is BrandColorPresetId {
  return normalizeShowcaseCuratedPaletteId(mode) !== null;
}
