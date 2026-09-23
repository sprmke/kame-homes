import { describe, expect, it } from 'vitest';

import { isBrandColorPresetId, getBrandColorPreset, BRAND_COLOR_PRESETS, BRAND_COLOR_PRESET_IDS } from '@/lib/theme/brandColorPresets';

describe('isBrandColorPresetId', () => {

  it('isBrandColorPresetId is exported', () => {
    expect(typeof isBrandColorPresetId).toBe('function');
  });

});

describe('getBrandColorPreset', () => {

  it('getBrandColorPreset is exported', () => {
    expect(typeof getBrandColorPreset).toBe('function');
  });

});

describe('BRAND_COLOR_PRESETS', () => {
  it('is defined', () => {
    expect(BRAND_COLOR_PRESETS).toBeDefined();
  });
});

describe('BRAND_COLOR_PRESET_IDS', () => {
  it('is defined', () => {
    expect(BRAND_COLOR_PRESET_IDS).toBeDefined();
  });
});
