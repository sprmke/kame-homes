import { describe, expect, it } from 'vitest';

import { rgbToHsv, hsvToRgb, hsvToHex, hexToHsv, normalizePickerHex } from '@/lib/theme/hsvColor';

describe('rgbToHsv', () => {

  it('rgbToHsv is exported', () => {
    expect(typeof rgbToHsv).toBe('function');
  });

});

describe('hsvToRgb', () => {

  it('hsvToRgb is exported', () => {
    expect(typeof hsvToRgb).toBe('function');
  });

});

describe('hsvToHex', () => {

  it('hsvToHex is exported', () => {
    expect(typeof hsvToHex).toBe('function');
  });

});

describe('hexToHsv', () => {

  it('hexToHsv is exported', () => {
    expect(typeof hexToHsv).toBe('function');
  });

});

describe('normalizePickerHex', () => {

  it('normalizePickerHex is exported', () => {
    expect(typeof normalizePickerHex).toBe('function');
  });

});
