import { describe, expect, it } from 'vitest';

import { typographyPresetForLayer, resolveLayerTypography, buildTypographyFromPreset, typographyToCss, VIDEO_FONT_FAMILIES } from '@/features/dashboard/marketing/lib/video/videoLayerTypography';

describe('typographyPresetForLayer', () => {

  it('typographyPresetForLayer is exported', () => {
    expect(typeof typographyPresetForLayer).toBe('function');
  });

});

describe('resolveLayerTypography', () => {

  it('resolveLayerTypography is exported', () => {
    expect(typeof resolveLayerTypography).toBe('function');
  });

});

describe('buildTypographyFromPreset', () => {

  it('buildTypographyFromPreset is exported', () => {
    expect(typeof buildTypographyFromPreset).toBe('function');
  });

});

describe('typographyToCss', () => {

  it('typographyToCss is exported', () => {
    expect(typeof typographyToCss).toBe('function');
  });

});

describe('VIDEO_FONT_FAMILIES', () => {
  it('is defined', () => {
    expect(VIDEO_FONT_FAMILIES).toBeDefined();
  });
});
