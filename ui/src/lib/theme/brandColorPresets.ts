import { DEFAULT_ORG_BRAND_COLOR } from '@/lib/theme/brandColor';

/** Shared with property/org Brand color settings and showcase curated palettes. */
export const BRAND_COLOR_PRESETS = [
  { id: 'coral', label: 'Coral', hex: '#FB923C' },
  { id: 'amber', label: 'Amber', hex: '#FBBF24' },
  { id: 'lime', label: 'Lime', hex: '#A3E635' },
  { id: 'emerald', label: 'Emerald', hex: '#34D399' },
  { id: 'teal', label: 'Teal', hex: DEFAULT_ORG_BRAND_COLOR },
  { id: 'sky', label: 'Sky', hex: '#38BDF8' },
  { id: 'indigo', label: 'Indigo', hex: '#6366F1' },
  { id: 'violet', label: 'Violet', hex: '#A78BFA' },
  { id: 'fuchsia', label: 'Fuchsia', hex: '#E879F9' },
  { id: 'pink', label: 'Pink', hex: '#F472B6' },
  { id: 'rose', label: 'Rose', hex: '#FB7185' },
] as const;

export type BrandColorPresetId = (typeof BRAND_COLOR_PRESETS)[number]['id'];

export const BRAND_COLOR_PRESET_IDS = BRAND_COLOR_PRESETS.map((preset) => preset.id);

export function isBrandColorPresetId(value: unknown): value is BrandColorPresetId {
  return typeof value === 'string' && (BRAND_COLOR_PRESET_IDS as readonly string[]).includes(value);
}

export function getBrandColorPreset(id: BrandColorPresetId) {
  return BRAND_COLOR_PRESETS.find((preset) => preset.id === id)!;
}
