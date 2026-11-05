import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MARKETING_THEME_TOKENS,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  parseCssColor,
  rgbToOklch,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import {
  createThemeColorRemapper,
  createThemeFontRemapper,
  createThemeRadiusRemapper,
  lockedPathMatcher,
  remapThemeTree,
} from '@/features/dashboard/marketing/lib/theme/themeRemap';

const lavender: MarketingThemeTokens = {
  version: 1,
  palette: {
    primary: '#a48ee0',
    secondary: '#f3edfd',
    accent: '#ff8fa8',
    surface: '#fffaf6',
    ink: '#5b3f8f',
  },
  fonts: { display: 'Fraunces', body: 'Poppins', label: 'Poppins' },
  background: 'solid',
  corners: 'round',
};

const ocean: MarketingThemeTokens = {
  version: 1,
  palette: {
    primary: '#2a9d8f',
    secondary: '#dff3ef',
    accent: '#e76f51',
    surface: '#f7fbfa',
    ink: '#16324a',
  },
  fonts: { display: 'Playfair Display', body: 'Lora', label: 'Montserrat' },
  background: 'solid',
  corners: 'sharp',
};

const hue = (hex: string) => rgbToOklch(parseCssColor(hex)!).h;

describe('createThemeColorRemapper', () => {
  const remap = createThemeColorRemapper(lavender.palette, ocean.palette);

  it('maps every anchor exactly onto the new anchor', () => {
    for (const role of ['primary', 'secondary', 'accent', 'surface', 'ink'] as const) {
      expect(remap(lavender.palette[role])).toBe(ocean.palette[role]);
    }
  });

  it('keeps a tint a tint of the new hue', () => {
    // #c1b3e0 is a lighter lavender (day names) → a lighter teal.
    const mapped = remap('#c1b3e0');
    expect(Math.abs(hue(mapped) - hue(ocean.palette.primary))).toBeLessThan(25);
    expect(rgbToOklch(parseCssColor(mapped)!).L).toBeGreaterThan(
      rgbToOklch(parseCssColor(ocean.palette.primary)!).L
    );
  });

  it('keeps pure white and black, and preserves alpha and notation', () => {
    expect(remap('#ffffff')).toBe('#ffffff');
    expect(remap('#000000')).toBe('#000000');
    const shadow = remap('rgba(164, 142, 224, 0.28)');
    expect(shadow).toMatch(/^rgba\(\d+, \d+, \d+, 0\.28\)$/);
    expect(shadow).toBe(`rgba(42, 157, 143, 0.28)`);
  });

  it('is the identity for the same palette and leaves non-colors alone', () => {
    const same = createThemeColorRemapper(lavender.palette, { ...lavender.palette });
    expect(same('#c1b3e0')).toBe('#c1b3e0');
    expect(remap('transparent')).toBe('transparent');
  });
});

describe('font and radius remappers', () => {
  it('maps fonts by role, using the field path when a family fills two roles', () => {
    const font = createThemeFontRemapper(lavender.fonts, ocean.fonts);
    expect(font('Fraunces', 'header.monthYear.font.family')).toBe('Playfair Display');
    expect(font('Poppins', 'dayNames.font.family')).toBe('Montserrat');
    expect(font('Poppins', 'cell.dayNumber.font.family')).toBe('Lora');
    expect(font('Nunito Sans', 'header.subtitle.font.family')).toBe('Lora');
    expect(font('Nunito Sans', 'legend.item.labelFont.family')).toBe('Montserrat');
    expect(font('system-ui')).toBe('system-ui');
  });

  it('scales corners but keeps pills unless going sharp', () => {
    const toSharp = createThemeRadiusRemapper('round', 'sharp');
    expect(toSharp(999)).toBe(6);
    expect(toSharp(20)).toBe(4);
    expect(createThemeRadiusRemapper('sharp', 'soft')(999)).toBe(999);
    expect(createThemeRadiusRemapper('soft', 'soft')(13)).toBe(13);
  });
});

describe('remapThemeTree', () => {
  const tree = {
    header: { title: { text: '#ace', color: '#a48ee0', font: { family: 'Fraunces', size: 40 } } },
    cell: { borderRadius: 999, border: { radius: 20, color: '#f3edfd' } },
    canvasFrame: { background: { type: 'solid', color: '#a48ee0' } },
    list: ['#ff8fa8', 'plain'],
    imageUrl: 'https://x.test/a.jpg#fff',
  };

  it('returns the same reference for the same theme', () => {
    expect(remapThemeTree(tree, lavender, { ...lavender })).toBe(tree);
  });

  it('remaps colors, fonts and radii without touching text, urls or the input', () => {
    const before = structuredClone(tree);
    const out = remapThemeTree(tree, lavender, ocean);
    expect(tree).toEqual(before);
    expect(out.header.title.color).toBe(ocean.palette.primary);
    expect(out.header.title.text).toBe('#ace');
    expect(out.header.title.font).toEqual({ family: 'Playfair Display', size: 40 });
    expect(out.cell.borderRadius).toBe(6);
    expect(out.cell.border).toEqual({ radius: 4, color: ocean.palette.secondary });
    expect(out.list).toEqual([ocean.palette.accent, 'plain']);
    expect(out.imageUrl).toBe(tree.imageUrl);
  });

  it('honors skipKeys and locked paths (including prefixes)', () => {
    const isLocked = lockedPathMatcher(['cell.border', 'list.0']);
    const out = remapThemeTree(tree, lavender, ocean, {
      isLocked,
      skipKeys: new Set(['canvasFrame']),
    });
    expect(out.canvasFrame).toBe(tree.canvasFrame);
    expect(out.cell.border).toEqual(tree.cell.border);
    expect(out.cell.borderRadius).toBe(6);
    expect(out.list).toEqual(['#ff8fa8', 'plain']);
  });

  it('works for the default theme in both directions', () => {
    const out = remapThemeTree(
      { a: DEFAULT_MARKETING_THEME_TOKENS.palette.primary },
      DEFAULT_MARKETING_THEME_TOKENS,
      ocean
    );
    expect(out.a).toBe(ocean.palette.primary);
  });
});

describe('lockedPathMatcher', () => {
  it('returns undefined when nothing is locked', () => {
    expect(lockedPathMatcher([])).toBeUndefined();
    expect(lockedPathMatcher(undefined)).toBeUndefined();
  });

  it('matches exact paths and descendants only', () => {
    const match = lockedPathMatcher(['today.border'])!;
    expect(match('today.border')).toBe(true);
    expect(match('today.border.color')).toBe(true);
    expect(match('today.borderColor')).toBe(false);
    expect(match('today')).toBe(false);
  });
});
