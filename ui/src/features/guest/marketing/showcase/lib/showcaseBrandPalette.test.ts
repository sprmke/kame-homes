import { describe, expect, it } from 'vitest';

import { parseBrandColorHsl, buildShowcaseBrandPalette, buildShowcasePaletteTones, buildShowcaseDefaultInkTones, showcaseInkCssVars, showcasePaletteToneCssVars } from '@/features/guest/marketing/showcase/lib/showcaseBrandPalette';

describe('parseBrandColorHsl', () => {

  it('parseBrandColorHsl is exported', () => {
    expect(typeof parseBrandColorHsl).toBe('function');
  });

});

describe('buildShowcaseBrandPalette', () => {

  it('buildShowcaseBrandPalette is exported', () => {
    expect(typeof buildShowcaseBrandPalette).toBe('function');
  });

});

describe('buildShowcasePaletteTones', () => {

  it('buildShowcasePaletteTones is exported', () => {
    expect(typeof buildShowcasePaletteTones).toBe('function');
  });

});

describe('buildShowcaseDefaultInkTones', () => {

  it('buildShowcaseDefaultInkTones is exported', () => {
    expect(typeof buildShowcaseDefaultInkTones).toBe('function');
  });

});

describe('showcaseInkCssVars', () => {

  it('showcaseInkCssVars is exported', () => {
    expect(typeof showcaseInkCssVars).toBe('function');
  });

});

describe('showcasePaletteToneCssVars', () => {

  it('showcasePaletteToneCssVars is exported', () => {
    expect(typeof showcasePaletteToneCssVars).toBe('function');
  });

});
