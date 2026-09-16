import type { AnalyticsDistributions } from '@/features/dashboard/analytics/lib/types';

export const GUEST_ORIGINS_DISPLAY_LIMIT = 6;
export const GUEST_ORIGINS_OTHERS_LABEL = 'Others';

type GuestOrigin = AnalyticsDistributions['guestOrigins'][number];

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Ranked display list: at most 6 distinct origins.
 * When more exist, keep the top 5 and fold the rest into a trailing Others row.
 */
export function collapseTopGuestOrigins(
  origins: GuestOrigin[],
  limit = GUEST_ORIGINS_DISPLAY_LIMIT
): GuestOrigin[] {
  const merged = new Map<string, number>();
  for (const item of origins) {
    if (!item.origin || item.count <= 0) continue;
    merged.set(item.origin, (merged.get(item.origin) ?? 0) + item.count);
  }

  const distinct = [...merged.entries()]
    .map(([origin, count]) => ({ origin, count }))
    .sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin));

  const total = distinct.reduce((sum, item) => sum + item.count, 0);
  const withPct = (items: Array<{ origin: string; count: number }>): GuestOrigin[] =>
    items.map((item) => ({
      origin: item.origin,
      count: item.count,
      pct: total > 0 ? roundPct((item.count / total) * 100) : 0,
    }));

  if (distinct.length <= limit) return withPct(distinct);

  const named = distinct.slice(0, limit - 1);
  const restCount = distinct.slice(limit - 1).reduce((sum, item) => sum + item.count, 0);
  return withPct([...named, { origin: GUEST_ORIGINS_OTHERS_LABEL, count: restCount }]);
}
