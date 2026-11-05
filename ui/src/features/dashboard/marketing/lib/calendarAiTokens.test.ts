import { describe, expect, it } from 'vitest';

import {
  calendarAiArchetypeSeed,
  normalizeCalendarTemplateTokens,
} from '@/features/dashboard/marketing/lib/calendarAiTokens';
import { CALENDAR_DESIGNER_PRESET_IDS } from '@/features/dashboard/marketing/lib/calendarPresetCatalog';

describe('normalizeCalendarTemplateTokens', () => {
  it('fills defaults, cleans hexes and clips copy at a word boundary', () => {
    const tokens = normalizeCalendarTemplateTokens({
      layoutArchetype: 'nope' as never,
      palette: { primary: '#ABCDEF', secondary: 'red', accent: '#123456' },
      subtitle: 'Open nights this month for long weekend getaways and family trips',
    });
    expect(tokens.layoutArchetype).toBe('bubble');
    expect(tokens.palette).toEqual({ primary: '#abcdef', secondary: '#f3edfd', accent: '#123456' });
    expect(tokens.subtitle.length).toBeLessThanOrEqual(48);
    expect(tokens.subtitle.endsWith(' ')).toBe(false);
  });
});

describe('calendarAiArchetypeSeed', () => {
  it('maps every archetype to a real designer layout', () => {
    for (const archetype of [
      'bubble',
      'widget',
      'type-forward',
      'geo-pattern',
      'botanical',
      'photo-wash',
      'dusk-gradient',
    ] as const) {
      expect(CALENDAR_DESIGNER_PRESET_IDS).toContain(calendarAiArchetypeSeed(archetype));
    }
  });
});
