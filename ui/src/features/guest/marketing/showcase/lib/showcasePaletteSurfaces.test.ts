import { describe, expect, it } from 'vitest';

import { usesShowcaseCustomPalette, resolveShowcasePaletteSurface, resolveShowcasePaletteAccent, resolveShowcasePaletteTones, resolveShowcasePaletteToneStyle } from '@/features/guest/marketing/showcase/lib/showcasePaletteSurfaces';

describe('usesShowcaseCustomPalette', () => {

  it('usesShowcaseCustomPalette is exported', () => {
    expect(typeof usesShowcaseCustomPalette).toBe('function');
  });

});

describe('resolveShowcasePaletteSurface', () => {

  it('resolveShowcasePaletteSurface is exported', () => {
    expect(typeof resolveShowcasePaletteSurface).toBe('function');
  });

});

describe('resolveShowcasePaletteAccent', () => {

  it('resolveShowcasePaletteAccent is exported', () => {
    expect(typeof resolveShowcasePaletteAccent).toBe('function');
  });

});

describe('resolveShowcasePaletteTones', () => {

  it('resolveShowcasePaletteTones is exported', () => {
    expect(typeof resolveShowcasePaletteTones).toBe('function');
  });

});

describe('resolveShowcasePaletteToneStyle', () => {

  it('resolveShowcasePaletteToneStyle is exported', () => {
    expect(typeof resolveShowcasePaletteToneStyle).toBe('function');
  });

});
