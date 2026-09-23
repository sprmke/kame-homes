import { describe, expect, it } from 'vitest';

import { manilaDateParts, isoFromManilaParts, manilaTodayIso, manilaRangeForPreset, detectManilaRangePreset } from '@/lib/date/manilaPeriod';

describe('manilaDateParts', () => {

  it('manilaDateParts is exported', () => {
    expect(typeof manilaDateParts).toBe('function');
  });

});

describe('isoFromManilaParts', () => {

  it('isoFromManilaParts is exported', () => {
    expect(typeof isoFromManilaParts).toBe('function');
  });

});

describe('manilaTodayIso', () => {

  it('manilaTodayIso is exported', () => {
    expect(typeof manilaTodayIso).toBe('function');
  });

});

describe('manilaRangeForPreset', () => {

  it('manilaRangeForPreset is exported', () => {
    expect(typeof manilaRangeForPreset).toBe('function');
  });

});

describe('detectManilaRangePreset', () => {

  it('detectManilaRangePreset is exported', () => {
    expect(typeof detectManilaRangePreset).toBe('function');
  });

});
