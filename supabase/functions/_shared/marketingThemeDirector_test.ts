import { assertEquals } from 'jsr:@std/assert@1';

import { parseGeneratedTheme } from './marketingThemeDirector.ts';
import { parseMarketingThemeTokens } from './marketingTheme.ts';

Deno.test('parseGeneratedTheme keeps a valid model answer', () => {
  const theme = parseGeneratedTheme({
    name: '"Sandy Shore"',
    palette: {
      primary: '#2A9D8F',
      secondary: '#dff3ef',
      accent: '#e76f51',
      surface: '#f7fbfa',
      ink: '#16324a',
    },
    fonts: { display: 'Playfair Display', body: 'Lora', label: 'Montserrat' },
    background: 'soft-gradient',
    corners: 'soft',
  });
  assertEquals(theme.name, 'Sandy Shore');
  assertEquals(theme.tokens.palette.primary, '#2a9d8f');
  assertEquals(theme.tokens.background, 'soft-gradient');
});

Deno.test('parseGeneratedTheme never fails on junk', () => {
  const theme = parseGeneratedTheme({ name: '   ', palette: 'x', fonts: null }, 'AI theme');
  assertEquals(theme.name, 'AI theme');
  assertEquals(parseMarketingThemeTokens(theme.tokens), theme.tokens);
  assertEquals(parseGeneratedTheme(null).name, 'AI theme');
});
