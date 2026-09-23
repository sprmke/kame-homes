import { describe, expect, it } from 'vitest';

import { normalizeShowcasePresetPaletteId, isShowcasePresetPaletteId, getShowcasePresetPalette, showcasePaletteHasOwnAccent, SHOWCASE_PRESET_PALETTE_IDS, SHOWCASE_PRESET_PALETTE_LIST } from '@/features/guest/marketing/showcase/lib/showcasePresetPalettes';

describe('normalizeShowcasePresetPaletteId', () => {

  it('normalizeShowcasePresetPaletteId is exported', () => {
    expect(typeof normalizeShowcasePresetPaletteId).toBe('function');
  });

});

describe('isShowcasePresetPaletteId', () => {

  it('isShowcasePresetPaletteId is exported', () => {
    expect(typeof isShowcasePresetPaletteId).toBe('function');
  });

});

describe('getShowcasePresetPalette', () => {

  it('getShowcasePresetPalette is exported', () => {
    expect(typeof getShowcasePresetPalette).toBe('function');
  });

});

describe('showcasePaletteHasOwnAccent', () => {

  it('showcasePaletteHasOwnAccent is exported', () => {
    expect(typeof showcasePaletteHasOwnAccent).toBe('function');
  });

});

describe('SHOWCASE_PRESET_PALETTE_IDS', () => {
  it('is defined', () => {
    expect(SHOWCASE_PRESET_PALETTE_IDS).toBeDefined();
  });
});

describe('SHOWCASE_PRESET_PALETTE_LIST', () => {
  it('is defined', () => {
    expect(SHOWCASE_PRESET_PALETTE_LIST).toBeDefined();
  });
});
