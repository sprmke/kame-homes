import { describe, expect, it } from 'vitest';

import {
  GUEST_ORIGINS_OTHERS_LABEL,
  collapseTopGuestOrigins,
} from '@/features/dashboard/analytics/lib/guestOriginsDisplay';

function origin(label: string, count: number, pct = 0) {
  return { origin: label, count, pct };
}

describe('collapseTopGuestOrigins', () => {
  it('returns all distinct origins when there are 6 or fewer', () => {
    const collapsed = collapseTopGuestOrigins([
      origin('Makati, Metro Manila', 3),
      origin('Malaysia', 1),
      origin('Quezon City, Metro Manila', 1),
    ]);
    expect(collapsed.map((item) => item.origin)).toEqual([
      'Makati, Metro Manila',
      'Malaysia',
      'Quezon City, Metro Manila',
    ]);
    expect(collapsed.map((item) => item.pct)).toEqual([60, 20, 20]);
  });

  it('merges duplicate labels before ranking', () => {
    const collapsed = collapseTopGuestOrigins([
      origin('Makati, Metro Manila', 2),
      origin('Makati, Metro Manila', 1),
      origin('Malaysia', 1),
    ]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]).toMatchObject({ origin: 'Makati, Metro Manila', count: 3, pct: 75 });
  });

  it('keeps the top 5 and folds the rest into Others when there are more than 6', () => {
    const collapsed = collapseTopGuestOrigins([
      origin('Makati, Metro Manila', 8),
      origin('Quezon City, Metro Manila', 4),
      origin('Malaysia', 3),
      origin('Iloilo City, Iloilo', 3),
      origin('Mandaue, Cebu', 2),
      origin('Manila, Metro Manila', 2),
      origin('Singapore', 1),
      origin('Unknown', 1),
    ]);

    expect(collapsed).toHaveLength(6);
    expect(collapsed.map((item) => item.origin)).toEqual([
      'Makati, Metro Manila',
      'Quezon City, Metro Manila',
      'Iloilo City, Iloilo',
      'Malaysia',
      'Mandaue, Cebu',
      GUEST_ORIGINS_OTHERS_LABEL,
    ]);
    expect(collapsed[5]).toMatchObject({
      origin: GUEST_ORIGINS_OTHERS_LABEL,
      count: 4,
      pct: 16.67,
    });
  });

  it('does not add Others when there are exactly 6 distinct origins', () => {
    const collapsed = collapseTopGuestOrigins([
      origin('A', 6),
      origin('B', 5),
      origin('C', 4),
      origin('D', 3),
      origin('E', 2),
      origin('F', 1),
    ]);
    expect(collapsed).toHaveLength(6);
    expect(collapsed.some((item) => item.origin === GUEST_ORIGINS_OTHERS_LABEL)).toBe(false);
    expect(collapsed[5].origin).toBe('F');
  });
});
