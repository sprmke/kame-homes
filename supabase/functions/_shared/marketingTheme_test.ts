import { assertEquals } from 'jsr:@std/assert@1';

import {
  coerceMarketingThemeTokens,
  DEFAULT_MARKETING_THEME_TOKENS,
  isMarketingThemeKey,
  isMarketingThemeRowId,
  normalizeMarketingThemeName,
  parseMarketingThemeTokens,
} from './marketingTheme.ts';

const VALID = {
  version: 1,
  palette: {
    primary: '#A48EE0',
    secondary: '#f3edfd',
    accent: '#f8a',
    surface: '#fffaf6',
    ink: '#5b3f8f',
  },
  fonts: { display: 'Fraunces', body: 'Poppins', label: 'Poppins' },
  background: 'solid',
  corners: 'round',
};

Deno.test('parseMarketingThemeTokens normalizes a valid theme', () => {
  const parsed = parseMarketingThemeTokens(VALID);
  assertEquals(parsed?.palette.primary, '#a48ee0');
  assertEquals(parsed?.palette.accent, '#ff88aa');
  assertEquals(parsed?.fonts.body, 'Poppins');
});

Deno.test('parseMarketingThemeTokens rejects bad input', () => {
  assertEquals(parseMarketingThemeTokens(null), null);
  assertEquals(parseMarketingThemeTokens([]), null);
  assertEquals(
    parseMarketingThemeTokens({ ...VALID, palette: { ...VALID.palette, ink: 'red' } }),
    null
  );
  assertEquals(
    parseMarketingThemeTokens({ ...VALID, fonts: { ...VALID.fonts, display: '<script>' } }),
    null
  );
  assertEquals(parseMarketingThemeTokens({ ...VALID, background: 'video' }), null);
  assertEquals(parseMarketingThemeTokens({ ...VALID, corners: undefined }), null);
});

Deno.test('theme keys accept built-ins and uuids only', () => {
  assertEquals(isMarketingThemeKey('property-colors'), true);
  assertEquals(isMarketingThemeKey('starter:social-availability'), true);
  assertEquals(isMarketingThemeKey('3f2b8c1e-5d4a-4c3b-9a2e-1f0e9d8c7b6a'), true);
  assertEquals(isMarketingThemeKey('starter:../../etc'), false);
  assertEquals(isMarketingThemeKey(''), false);
  assertEquals(isMarketingThemeRowId('property-colors'), false);
});

Deno.test('normalizeMarketingThemeName trims and bounds', () => {
  assertEquals(normalizeMarketingThemeName('  Summer   promo '), 'Summer promo');
  assertEquals(normalizeMarketingThemeName('   '), null);
  assertEquals(normalizeMarketingThemeName('x'.repeat(61)), null);
  assertEquals(normalizeMarketingThemeName(12), null);
});

Deno.test('coerceMarketingThemeTokens repairs off-list values field by field', () => {
  const coerced = coerceMarketingThemeTokens({
    palette: { primary: '#123456', ink: 'black' },
    fonts: { display: 'Lora', body: 'Comic Sans' },
    background: 'video',
    corners: 'round',
  });
  assertEquals(coerced.palette.primary, '#123456');
  assertEquals(coerced.palette.ink, DEFAULT_MARKETING_THEME_TOKENS.palette.ink);
  assertEquals(coerced.fonts.display, 'Lora');
  assertEquals(coerced.fonts.body, DEFAULT_MARKETING_THEME_TOKENS.fonts.body);
  assertEquals(coerced.background, 'solid');
  assertEquals(coerced.corners, 'round');
  assertEquals(parseMarketingThemeTokens(coerced), coerced);
});
