import { describe, expect, it } from 'vitest';

import { normalizeCalendarTemplateTokens } from '@/features/dashboard/marketing/lib/calendarAiTokens';
import { normalizeDesignTemplateTokens } from '@/features/dashboard/marketing/lib/designAiTokens';
import { POSTER_FONT_PAIRINGS } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  themedAiCalendarStyles,
  themedAiDesignTokens,
} from '@/features/dashboard/marketing/lib/theme/aiThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  posterPaletteInputFromTheme,
  themedPosterFontPairing,
} from '@/features/dashboard/marketing/lib/theme/posterThemeAdapter';

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
  background: 'pattern',
  corners: 'soft',
};

describe('AI calendar in a theme', () => {
  it('keeps the AI layout choice and words, takes colors and fonts from the theme', () => {
    const tokens = normalizeCalendarTemplateTokens({
      layoutArchetype: 'botanical',
      palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff' },
      fontPairing: 'playful-rounded',
      subtitle: 'Weekend nights open',
    });
    const styles = themedAiCalendarStyles(tokens, ocean, 'square');
    expect(styles.header.subtitle).toMatchObject({ show: true, text: 'Weekend nights open' });
    expect(styles.header.monthYear.font.family).toBe('Playfair Display');
    const json = JSON.stringify(styles).toLowerCase();
    expect(json).not.toContain('#ff0000');
    expect(json).not.toContain('#00ff00');
  });
});

describe('AI design in a theme', () => {
  it('overrides palette, type pairing and background, keeps layout and copy', () => {
    const tokens = normalizeDesignTemplateTokens({
      layoutArchetype: 'split-panel',
      palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff' },
      fontPairing: 'rounded-friendly',
      backgroundMood: 'photo',
    });
    const themed = themedAiDesignTokens(tokens, ocean);
    expect(themed.palette).toEqual({
      primary: ocean.palette.primary,
      secondary: ocean.palette.secondary,
      accent: ocean.palette.accent,
    });
    expect(themed.fontPairing).toBe('serif-editorial');
    expect(themed.backgroundMood).toBe('color-wash');
    expect(themed.layoutArchetype).toBe(tokens.layoutArchetype);
    expect(themed.copy).toEqual(tokens.copy);
  });
});

describe('AI Post in a theme', () => {
  it('uses the theme for the palette input and the three main faces', () => {
    expect(posterPaletteInputFromTheme(ocean)).toEqual({
      accent: ocean.palette.primary,
      secondary: ocean.palette.accent,
      field: ocean.palette.surface,
    });
    const base = POSTER_FONT_PAIRINGS['tropical-script'];
    const themed = themedPosterFontPairing(base, ocean);
    expect(themed.display.family).toBe('Playfair Display');
    expect(themed.body.family).toBe('Lora');
    expect(themed.eyebrow.family).toBe('Montserrat');
    expect(themed.chip.family).toBe('Montserrat');
    // The script accent and the type craft stay.
    expect(themed.script).toEqual(base.script);
    expect(themed.display.weight).toBe(base.display.weight);
  });
});
