import { describe, expect, it } from 'vitest';

import type { MarketingTemplateRecord } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  planCalendarRelatedCustomIds,
  planCalendarTemplateDedupe,
} from '@/features/dashboard/marketing/lib/calendarAutosave';
import { planDesignAutosavePurge } from '@/features/dashboard/marketing/lib/designAutosave';
import { DEFAULT_MARKETING_THEME_TOKENS } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  effectiveTemplateThemeKey,
  readTemplateThemeSnapshot,
  templatesInTheme,
  themeStampForSave,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';

const THEME_A = '3f2b8c1e-5d4a-4c3b-9a2e-1f0e9d8c7b6a';
const THEME_B = '9a2e1f0e-5d4a-4c3b-9a2e-3f2b8c1e7b6a';

function record(
  partial: Partial<MarketingTemplateRecord> & { id: string }
): MarketingTemplateRecord {
  return {
    name: 'Item',
    contentType: 'calendar',
    platform: null,
    aspectPreset: 'instagram-post',
    designJson: {},
    themeKey: null,
    updatedAt: '2026-10-01T00:00:00Z',
    ...partial,
  };
}

describe('effectiveTemplateThemeKey', () => {
  it('uses the stored key when present', () => {
    expect(effectiveTemplateThemeKey(record({ id: '1', themeKey: THEME_A }))).toBe(THEME_A);
  });

  it('puts legacy designer-look calendars in that look’s starter theme', () => {
    const legacy = record({ id: '1', designJson: { sourcePresetId: 'garden-glow' } });
    expect(effectiveTemplateThemeKey(legacy)).toBe('starter:garden-glow');
  });

  it('puts every other legacy item in Property colors', () => {
    expect(
      effectiveTemplateThemeKey(record({ id: '1', designJson: { sourcePresetId: 'custom' } }))
    ).toBe('property-colors');
    expect(
      effectiveTemplateThemeKey(
        record({ id: '2', contentType: 'design', designJson: { sourcePresetId: 'promo-500-off' } })
      )
    ).toBe('property-colors');
    expect(
      effectiveTemplateThemeKey(record({ id: '3', designJson: { sourcePresetId: 'not-a-preset' } }))
    ).toBe('property-colors');
  });

  it('filters a list to one theme', () => {
    const rows = [
      record({ id: '1', themeKey: THEME_A }),
      record({ id: '2', themeKey: THEME_B }),
      record({ id: '3' }),
    ];
    expect(templatesInTheme(rows, THEME_A).map((r) => r.id)).toEqual(['1']);
    expect(templatesInTheme(rows, 'property-colors').map((r) => r.id)).toEqual(['3']);
  });
});

describe('theme snapshot', () => {
  it('round-trips through a save stamp and drops junk', () => {
    const stamp = themeStampForSave(DEFAULT_MARKETING_THEME_TOKENS, ['a.b', 'a.b', 'c']);
    expect(stamp.lockedPaths).toEqual(['a.b', 'c']);
    const snapshot = readTemplateThemeSnapshot({ ...stamp });
    expect(snapshot.tokens).toEqual(DEFAULT_MARKETING_THEME_TOKENS);
    expect(snapshot.lockedPaths).toEqual(['a.b', 'c']);
    expect(readTemplateThemeSnapshot({ themeTokens: { nope: 1 }, lockedPaths: [1, 'x'] })).toEqual({
      tokens: null,
      lockedPaths: ['x'],
    });
  });
});

describe('cleanup never crosses themes (data safety)', () => {
  it('calendar dedupe keeps one autosave per theme, not one overall', () => {
    const rows = [
      record({ id: 'a1', themeKey: THEME_A, designJson: { sourcePresetId: 'desk-type' } }),
      record({ id: 'b1', themeKey: THEME_B, designJson: { sourcePresetId: 'desk-type' } }),
      record({
        id: 'a2',
        themeKey: THEME_A,
        designJson: { sourcePresetId: 'desk-type' },
        updatedAt: '2026-10-02T00:00:00Z',
      }),
    ];
    expect(planCalendarTemplateDedupe(rows)).toEqual(['a1']);
  });

  it('calendar format siblings with the same name stay in their own theme', () => {
    const rows = [
      record({
        id: 'a-sq',
        name: 'Summer',
        themeKey: THEME_A,
        designJson: { sourcePresetId: 'custom' },
      }),
      record({
        id: 'a-po',
        name: 'Summer',
        themeKey: THEME_A,
        aspectPreset: 'instagram-story',
        designJson: { sourcePresetId: 'custom' },
      }),
      record({
        id: 'b-sq',
        name: 'Summer',
        themeKey: THEME_B,
        designJson: { sourcePresetId: 'custom' },
      }),
    ];
    expect(planCalendarRelatedCustomIds(rows, 'a-sq').sort()).toEqual(['a-po', 'a-sq']);
  });

  it('design purge keeps the newest autosave per theme + preset + format', () => {
    const design = (id: string, themeKey: string | null, updatedAt: string) =>
      record({
        id,
        contentType: 'design',
        themeKey,
        updatedAt,
        designJson: {
          sourcePresetId: 'promo-500-off-instagram-post',
          templateId: 'promo-500-off-instagram-post',
        },
      });
    const rows = [
      design('old', null, '2026-01-01T00:00:00Z'),
      design('new', null, '2026-02-01T00:00:00Z'),
      design('themed', THEME_A, '2026-01-15T00:00:00Z'),
    ];
    expect(planDesignAutosavePurge(rows)).toEqual(['old']);
  });
});
