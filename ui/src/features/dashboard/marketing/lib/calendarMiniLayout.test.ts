import { describe, expect, it } from 'vitest';

import { calendarMiniLayout, miniCellShape } from '@/features/dashboard/marketing/lib/calendarMiniLayout';
import { CALENDAR_DESIGNER_PRESET_IDS } from '@/features/dashboard/marketing/lib/calendarPresets';
import { resolveThemedCalendarLayout } from '@/features/dashboard/marketing/lib/theme/calendarThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

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

const layout = (id: string, format: 'square' | 'portrait' | 'landscape' = 'square') =>
  calendarMiniLayout(resolveThemedCalendarLayout({ layoutId: id, theme: ocean, format }));

describe('calendarMiniLayout', () => {
  it('sizes the viewBox from the canvas format', () => {
    expect([layout('default').width, layout('default').height]).toEqual([108, 108]);
    expect([layout('default', 'portrait').width, layout('default', 'portrait').height]).toEqual([
      108, 192,
    ]);
    expect([layout('default', 'landscape').width, layout('default', 'landscape').height]).toEqual([
      192, 108,
    ]);
  });

  it('keeps every shape inside the canvas for every layout and format', () => {
    for (const id of ['default', ...CALENDAR_DESIGNER_PRESET_IDS]) {
      for (const format of ['square', 'portrait', 'landscape'] as const) {
        const mini = layout(id, format);
        expect(mini.cells).toHaveLength(35);
        for (const cell of mini.cells) {
          expect(cell.x).toBeGreaterThanOrEqual(0);
          expect(cell.y).toBeGreaterThanOrEqual(0);
          expect(cell.x + cell.size).toBeLessThanOrEqual(mini.width + 0.001);
          expect(cell.y + cell.size).toBeLessThanOrEqual(mini.height + 0.001);
        }
      }
    }
  });

  it('marks booked, blocked and empty days like the editor preview', () => {
    const mini = layout('default');
    const states = mini.cells.map((cell) => cell.state);
    expect(states.slice(0, 3)).toEqual(['empty', 'empty', 'empty']);
    expect(states[3]).toBe('blocked'); // day 1
    expect(states[7]).toBe('booked'); // day 5
    expect(states[11]).toBe('available'); // day 9
  });

  it('tells layouts apart by cell shape', () => {
    const shapes = new Set(
      CALENDAR_DESIGNER_PRESET_IDS.map((id) => {
        const styles = resolveThemedCalendarLayout({ layoutId: id, theme: ocean, format: 'square' });
        return miniCellShape(styles, 100);
      })
    );
    expect(shapes.size).toBeGreaterThan(1);
  });
});
