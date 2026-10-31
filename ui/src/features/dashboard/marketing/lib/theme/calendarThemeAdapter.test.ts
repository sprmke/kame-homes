import { describe, expect, it } from 'vitest';

import { resolveCalendarPresetStyles } from '@/features/dashboard/marketing/components/calendar-builder/stores/calendarBuilderStore';
import { normalizeCalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import { CALENDAR_DESIGNER_PRESET_IDS } from '@/features/dashboard/marketing/lib/calendarPresets';
import {
  preserveCalendarReadability,
  resolveThemedCalendarLayout,
  rethemeCalendarStyles,
} from '@/features/dashboard/marketing/lib/theme/calendarThemeAdapter';
import {
  parseMarketingThemeTokens,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { contrastRatio } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import {
  buildPropertyColorsThemeTokens,
  calendarLayoutSourceTokens,
  findStarterTheme,
  listStarterThemes,
} from '@/features/dashboard/marketing/lib/theme/starterThemes';

const FORMATS = ['square', 'portrait', 'landscape'] as const;

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

const night: MarketingThemeTokens = {
  ...ocean,
  palette: {
    primary: '#7c5cff',
    secondary: '#2b2650',
    accent: '#ffcf5c',
    surface: '#15132b',
    ink: '#f4f1ff',
  },
};

function withoutFrameBackground(styles: CalendarStyles) {
  const { canvasFrame, ...rest } = styles;
  const { background: _bg, ...frame } =
    canvasFrame ?? ({} as NonNullable<CalendarStyles['canvasFrame']>);
  return { ...rest, frame };
}

describe('starter themes', () => {
  it('covers every designer preset plus Quiet Coast, all strictly valid', () => {
    const starters = listStarterThemes();
    expect(starters).toHaveLength(CALENDAR_DESIGNER_PRESET_IDS.length + 1);
    for (const starter of starters) {
      expect(parseMarketingThemeTokens(starter.tokens), starter.id).toEqual(starter.tokens);
    }
    expect(findStarterTheme('social-availability')?.label).toBe('Bubble Pop');
  });

  it('property colors theme keeps ink at 7:1 on its surface', () => {
    const tokens = buildPropertyColorsThemeTokens({
      primary: '#9ccfe0',
      secondary: '#f4f8fa',
      accent: '#3a8fb0',
    });
    expect(parseMarketingThemeTokens(tokens)).toEqual(tokens);
    expect(contrastRatio(tokens.palette.ink, tokens.palette.surface)).toBeGreaterThanOrEqual(7);
    expect(tokens.palette.primary).toBe('#3a8fb0');
  });
});

describe('golden: starter theme + its layout = the original preset', () => {
  for (const presetId of CALENDAR_DESIGNER_PRESET_IDS) {
    for (const format of FORMATS) {
      it(`${presetId} · ${format}`, () => {
        const starter = findStarterTheme(presetId)!;
        const themed = resolveThemedCalendarLayout({
          layoutId: presetId,
          theme: starter.tokens,
          format,
        });
        // The preset as authored, framed for this format. Only the frame color may differ:
        // it follows the theme (it used to follow the org brand).
        const original = normalizeCalendarStyles({
          ...resolveCalendarPresetStyles(presetId),
          canvasFrame: themed.canvasFrame,
        });
        expect(withoutFrameBackground(themed)).toEqual(withoutFrameBackground(original));
        if (format !== 'square') {
          expect(themed.canvasFrame?.background.color).toBe(starter.tokens.palette.primary);
        }
      });
    }
  }
});

describe('re-theming a layout', () => {
  it('moves anchors, fonts and corners onto the new theme', () => {
    const styles = resolveThemedCalendarLayout({
      layoutId: 'social-availability',
      theme: ocean,
      format: 'portrait',
    });
    expect(styles.header.monthYear.font.family).toBe('Playfair Display');
    expect(styles.cell.dayNumber.font.family).toBe('Lora');
    expect(styles.dayNames.font.family).toBe('Montserrat');
    expect(styles.cell.borderRadius).toBe(6);
    expect(styles.container.background.color).toBe(ocean.palette.surface);
    expect(styles.header.monthYear.color).toBe(ocean.palette.ink);
    expect(styles.canvasFrame?.background.color).toBe(ocean.palette.primary);
  });

  it('never makes text less readable than the designer made it', () => {
    for (const presetId of CALENDAR_DESIGNER_PRESET_IDS) {
      const source = resolveThemedCalendarLayout({
        layoutId: presetId,
        theme: calendarLayoutSourceTokens(presetId),
        format: 'square',
      });
      const themed = resolveThemedCalendarLayout({
        layoutId: presetId,
        theme: night,
        format: 'square',
      });
      const target = Math.min(
        4.5,
        contrastRatio(source.cell.dayNumber.color, source.container.background.color) || 4.5
      );
      if (
        themed.container.background.type === 'solid' &&
        themed.cell.background.color === 'transparent'
      ) {
        expect(
          contrastRatio(themed.cell.dayNumber.color, themed.container.background.color),
          presetId
        ).toBeGreaterThanOrEqual(target - 0.01);
      }
      expect(
        contrastRatio(
          themed.header.monthYear.color,
          themed.container.background.color ?? '#ffffff'
        ),
        presetId
      ).toBeGreaterThan(1);
    }
  });

  it('round-trips through another theme and back to the same anchors', () => {
    const start = resolveThemedCalendarLayout({
      layoutId: 'garden-glow',
      theme: ocean,
      format: 'square',
    });
    const there = rethemeCalendarStyles(start, ocean, night);
    const back = rethemeCalendarStyles(there, night, ocean);
    expect(back.header.monthYear.font.family).toBe(start.header.monthYear.font.family);
    expect(back.container.background.color).toBe(start.container.background.color);
  });

  it('keeps locked paths and returns the same object for the same theme', () => {
    const start = resolveThemedCalendarLayout({
      layoutId: 'social-availability',
      theme: ocean,
      format: 'square',
    });
    const custom = { ...start, today: { ...start.today, dayNumberColor: '#123456' } };
    expect(rethemeCalendarStyles(custom, ocean, { ...ocean })).toBe(custom);
    const moved = rethemeCalendarStyles(custom, ocean, night, {
      lockedPaths: ['today.dayNumberColor'],
    });
    expect(moved.today.dayNumberColor).toBe('#123456');
    expect(moved.header.monthYear.color).not.toBe(start.header.monthYear.color);
  });

  it('applies a new background style only when it changes', () => {
    const start = resolveThemedCalendarLayout({
      layoutId: 'desk-type',
      theme: ocean,
      format: 'square',
    });
    const patterned = rethemeCalendarStyles(start, ocean, { ...ocean, background: 'pattern' });
    expect(patterned.container.background.type).toBe('pattern');
    const photo = rethemeCalendarStyles(
      start,
      ocean,
      { ...ocean, background: 'photo-wash' },
      {
        propertyPhotoUrl: 'https://x.test/p.jpg',
      }
    );
    expect(photo.container.background).toMatchObject({
      type: 'image',
      imageUrl: 'https://x.test/p.jpg',
    });
    const noPhoto = rethemeCalendarStyles(start, ocean, { ...ocean, background: 'photo-wash' });
    expect(noPhoto.container.background.type).toBe('gradient');
  });
});

describe('preserveCalendarReadability', () => {
  it('only raises contrast up to what the source had', () => {
    const source = resolveThemedCalendarLayout({
      layoutId: 'social-availability',
      theme: ocean,
      format: 'square',
    });
    const faint = {
      ...source,
      available: { ...source.available, dayNumberColor: source.available.background.color },
    };
    const fixed = preserveCalendarReadability(faint, source);
    expect(
      contrastRatio(fixed.available.dayNumberColor, fixed.available.background.color)
    ).toBeGreaterThanOrEqual(
      Math.min(
        4.5,
        contrastRatio(source.available.dayNumberColor, source.available.background.color)
      ) - 0.01
    );
  });
});
