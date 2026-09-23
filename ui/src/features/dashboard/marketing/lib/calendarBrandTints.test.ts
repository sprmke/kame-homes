import { describe, expect, it } from 'vitest';

import { calendarBrandLightTint, calendarBrandDarkShade, calendarBrandPalette } from '@/features/dashboard/marketing/lib/calendarBrandTints';

describe('calendarBrandLightTint', () => {

  it('calendarBrandLightTint is exported', () => {
    expect(typeof calendarBrandLightTint).toBe('function');
  });

});

describe('calendarBrandDarkShade', () => {

  it('calendarBrandDarkShade is exported', () => {
    expect(typeof calendarBrandDarkShade).toBe('function');
  });

});

describe('calendarBrandPalette', () => {

  it('calendarBrandPalette is exported', () => {
    expect(typeof calendarBrandPalette).toBe('function');
  });

});
