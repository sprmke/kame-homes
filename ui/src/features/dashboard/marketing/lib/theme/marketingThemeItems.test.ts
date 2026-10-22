import { describe, expect, it } from 'vitest';

import type { MarketingTemplateRecord } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { DEFAULT_MARKETING_THEME_TOKENS } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  effectiveTemplateThemeKey,
  latestItemsByTheme,
  readTemplateThemeSnapshot,
  savedRecordThumbnail,
  savedThumbnailStale,
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

describe('theme card items', () => {
  it('picks the newest calendar, post and video per theme', () => {
    const rows = [
      record({ id: 'c1', themeKey: THEME_A, updatedAt: '2026-10-01T00:00:00Z' }),
      record({ id: 'c2', themeKey: THEME_A, updatedAt: '2026-10-05T00:00:00Z' }),
      record({ id: 'p1', themeKey: THEME_A, contentType: 'design' }),
      record({ id: 'v1', themeKey: THEME_B, contentType: 'video' }),
      record({ id: 'legacy', contentType: 'design' }),
    ];
    const map = latestItemsByTheme(rows);
    expect(map.get(THEME_A)?.calendar?.id).toBe('c2');
    expect(map.get(THEME_A)?.design?.id).toBe('p1');
    expect(map.get(THEME_A)?.video).toBeUndefined();
    expect(map.get(THEME_B)?.video?.id).toBe('v1');
    expect(map.get('property-colors')?.design?.id).toBe('legacy');
  });

  it('prefers the stored thumbnail and skips stale ones', () => {
    expect(
      savedRecordThumbnail(
        record({
          id: 'a',
          thumbnailUrl: 'https://x.test/a.jpg',
          designJson: { thumbnailDataUrl: 'data:x' },
        })
      )
    ).toBe('https://x.test/a.jpg');
    expect(
      savedRecordThumbnail(record({ id: 'b', designJson: { thumbnailDataUrl: 'nope' } }))
    ).toBe(undefined);
    const post = record({ id: 'p', contentType: 'design', designJson: { themeHash: 'h1' } });
    expect(savedThumbnailStale(post, 'h1')).toBe(false);
    expect(savedThumbnailStale(post, 'h2')).toBe(true);
    // Older posts without a snapshot keep their own look, so they are never stale.
    expect(savedThumbnailStale(record({ id: 'o', contentType: 'design' }), 'h2')).toBe(false);
    // Videos always render in the current theme.
    expect(savedThumbnailStale(record({ id: 'v', contentType: 'video' }), 'h2')).toBe(true);
  });
});
