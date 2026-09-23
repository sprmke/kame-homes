import { describe, expect, it } from 'vitest';

import { resolvePaletteModeSwatchColors, resolveAccentOptionPreview } from '@/features/guest/marketing/showcase/lib/showcasePalettePreview';

describe('resolvePaletteModeSwatchColors', () => {

  it('resolvePaletteModeSwatchColors is exported', () => {
    expect(typeof resolvePaletteModeSwatchColors).toBe('function');
  });

});

describe('resolveAccentOptionPreview', () => {

  it('resolveAccentOptionPreview is exported', () => {
    expect(typeof resolveAccentOptionPreview).toBe('function');
  });

});
