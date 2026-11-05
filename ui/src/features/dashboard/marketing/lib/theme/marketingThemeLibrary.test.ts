import { describe, expect, it } from 'vitest';

import type { MarketingThemeRecord } from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import { DEFAULT_MARKETING_THEME_TOKENS } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { buildMarketingThemeLibrary } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';

const FROM_STARTER = '3f2b8c1e-5d4a-4c3b-9a2e-1f0e9d8c7b6a';
const COPY_OF_COPY = '9a2e1f0e-5d4a-4c3b-9a2e-3f2b8c1e7b6a';

function row(id: string, sourceRef: string | null): MarketingThemeRecord {
  return {
    id,
    name: id.slice(0, 4),
    tokens: DEFAULT_MARKETING_THEME_TOKENS,
    source: 'starter',
    sourceRef,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

describe('buildMarketingThemeLibrary', () => {
  const library = buildMarketingThemeLibrary({
    propertyColorsTokens: DEFAULT_MARKETING_THEME_TOKENS,
    records: [row(FROM_STARTER, 'starter:garden-glow'), row(COPY_OF_COPY, FROM_STARTER)],
    itemCounts: { 'starter:desk-type': 2 },
  });

  it('features one look per group, the rest sit behind More looks', () => {
    const featured = library.starters.filter((entry) => entry.featured);
    const groups = new Set(library.starters.map((entry) => entry.group));
    expect(featured).toHaveLength(groups.size);
    expect(new Set(featured.map((entry) => entry.group)).size).toBe(groups.size);
  });

  it('lists starters only once they hold items', () => {
    expect(library.mine.map((entry) => entry.key)).toEqual([
      'property-colors',
      FROM_STARTER,
      COPY_OF_COPY,
      'starter:desk-type',
    ]);
  });

  it('themes made from a look (or a copy of one) keep its calendar layout', () => {
    expect(library.byKey.get(FROM_STARTER)?.calendarLayoutId).toBe('garden-glow');
    expect(library.byKey.get(COPY_OF_COPY)?.calendarLayoutId).toBe('garden-glow');
    expect(library.byKey.get('property-colors')?.calendarLayoutId).toBeUndefined();
  });
});
