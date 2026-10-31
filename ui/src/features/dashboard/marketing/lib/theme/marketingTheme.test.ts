import { describe, expect, it } from 'vitest';

import {
  coerceMarketingThemeTokens,
  DEFAULT_MARKETING_THEME_TOKENS,
  marketingThemeContrastIssues,
  marketingThemeHash,
  parseMarketingThemeTokens,
  resolveMarketingTheme,
  sameMarketingTheme,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  contrastRatio,
  formatCssColor,
  oklchToRgb,
  parseCssColor,
  rgbToOklch,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

const base = DEFAULT_MARKETING_THEME_TOKENS;

describe('marketingThemeColor', () => {
  it('parses and re-formats each notation', () => {
    expect(formatCssColor(parseCssColor('#ABC')!, 'hex3')).toBe('#aabbcc');
    expect(parseCssColor('#a48ee0')).toMatchObject({ r: 164, g: 142, b: 224, a: 1 });
    const rgba = parseCssColor('rgba(164, 142, 224, 0.28)')!;
    expect(rgba).toMatchObject({ a: 0.28, notation: 'rgba' });
    expect(formatCssColor(rgba, 'rgba')).toBe('rgba(164, 142, 224, 0.28)');
    expect(formatCssColor(parseCssColor('#11223380')!, 'hex8')).toBe('#11223380');
  });

  it('rejects non-colors', () => {
    for (const value of ['transparent', 'none', '#12', 'rgb(300,0,0)', 'url(#a)', '']) {
      expect(parseCssColor(value)).toBeNull();
    }
  });

  it('round-trips through OKLCh', () => {
    for (const hex of ['#a48ee0', '#ff8fa8', '#1f1a17', '#ffffff', '#24a88e']) {
      const rgb = parseCssColor(hex)!;
      const back = oklchToRgb(rgbToOklch(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('parseMarketingThemeTokens', () => {
  it('accepts a complete theme and normalizes hex case', () => {
    const parsed = parseMarketingThemeTokens({
      ...base,
      palette: { ...base.palette, primary: '#ABCDEF' },
    });
    expect(parsed?.palette.primary).toBe('#abcdef');
  });

  it('rejects missing roles, unknown fonts and unknown enums', () => {
    expect(parseMarketingThemeTokens(null)).toBeNull();
    expect(
      parseMarketingThemeTokens({ ...base, palette: { ...base.palette, ink: 'red' } })
    ).toBeNull();
    expect(
      parseMarketingThemeTokens({ ...base, fonts: { ...base.fonts, display: 'Comic Sans MS' } })
    ).toBeNull();
    expect(parseMarketingThemeTokens({ ...base, corners: 'pointy' })).toBeNull();
    expect(parseMarketingThemeTokens({ ...base, background: 'video' })).toBeNull();
  });

  it('photoLook is optional: kept when valid, dropped when unknown, never added', () => {
    expect(parseMarketingThemeTokens({ ...base, photoLook: 'golden-hour' })?.photoLook).toBe(
      'golden-hour'
    );
    const dropped = parseMarketingThemeTokens({ ...base, photoLook: 'disco' });
    expect(dropped).not.toBeNull();
    expect(dropped && 'photoLook' in dropped).toBe(false);
    expect(parseMarketingThemeTokens(base)).toEqual(base);
    expect(marketingThemeHash({ ...base, photoLook: 'detail' })).not.toBe(marketingThemeHash(base));
  });

  it('coerce keeps valid fields and fills the rest', () => {
    const coerced = coerceMarketingThemeTokens({
      palette: { primary: '#123456' },
      corners: 'round',
    });
    expect(coerced.palette.primary).toBe('#123456');
    expect(coerced.palette.surface).toBe(base.palette.surface);
    expect(coerced.corners).toBe('round');
    expect(parseMarketingThemeTokens(coerced)).toEqual(coerced);
  });
});

describe('marketingThemeHash', () => {
  it('is stable across key order and hex case', () => {
    const reordered = {
      corners: base.corners,
      background: base.background,
      fonts: { label: base.fonts.label, body: base.fonts.body, display: base.fonts.display },
      palette: { ...base.palette, primary: base.palette.primary.toUpperCase() },
      version: 1,
    } as MarketingThemeTokens;
    expect(marketingThemeHash(reordered)).toBe(marketingThemeHash(base));
    expect(sameMarketingTheme(reordered, base)).toBe(true);
  });

  it('changes when anything visible changes', () => {
    const hashes = new Set([
      marketingThemeHash(base),
      marketingThemeHash({ ...base, corners: 'sharp' }),
      marketingThemeHash({ ...base, background: 'pattern' }),
      marketingThemeHash({ ...base, fonts: { ...base.fonts, body: 'Lora' } }),
      marketingThemeHash({ ...base, palette: { ...base.palette, accent: '#000000' } }),
    ]);
    expect(hashes.size).toBe(5);
  });
});

describe('resolveMarketingTheme', () => {
  it('guarantees readable ink and on-colors for awkward palettes', () => {
    const awkward: MarketingThemeTokens = {
      ...base,
      palette: {
        primary: '#ffe66d',
        secondary: '#fff5c2',
        accent: '#f9f871',
        surface: '#fffbe0',
        ink: '#f5e6a0',
      },
    };
    const resolved = resolveMarketingTheme(awkward);
    expect(contrastRatio(resolved.readableInk, resolved.surface)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(resolved.muted, resolved.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(resolved.onPrimary, resolved.primary)).toBeGreaterThanOrEqual(3);
    expect(marketingThemeContrastIssues(awkward).length).toBeGreaterThan(0);
  });

  it('flags nothing for the default theme', () => {
    expect(marketingThemeContrastIssues(base)).toEqual([]);
  });
});
