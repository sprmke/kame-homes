import { describe, expect, it } from 'vitest';

import { clampChannel, hslToHex, parseHexRgb, rgbToHsl } from '@/lib/theme/colorConvert';

describe('parseHexRgb', () => {
  it('parses 6-digit hex', () => {
    expect(parseHexRgb('#14b8a6')).toEqual({ r: 20, g: 184, b: 166 });
  });

  it('returns null for invalid hex', () => {
    expect(parseHexRgb('#abc')).toBeNull();
    expect(parseHexRgb('14b8a6')).toBeNull();
  });
});

describe('rgbToHsl / hslToHex round trip', () => {
  it('preserves hue for brand teal', () => {
    const hsl = rgbToHsl(20, 184, 166);
    expect(hsl.h).toBeGreaterThan(160);
    expect(hsl.h).toBeLessThan(190);
    const hex = hslToHex(hsl.h, hsl.s, hsl.l);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('clampChannel', () => {
  it('clamps to range', () => {
    expect(clampChannel(150)).toBe(100);
    expect(clampChannel(-5)).toBe(0);
    expect(clampChannel(50)).toBe(50);
  });
});
