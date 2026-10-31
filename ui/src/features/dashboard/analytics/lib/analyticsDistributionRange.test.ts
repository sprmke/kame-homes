import { describe, expect, it } from 'vitest';

import {
  LEAD_TIME_BUCKET_ORDER,
  fillDistributionRange,
} from '@/features/dashboard/analytics/lib/analyticsDistributionRange';

describe('fillDistributionRange', () => {
  it('returns the full order at zero when empty', () => {
    const filled = fillDistributionRange([], LEAD_TIME_BUCKET_ORDER);
    expect(filled).toHaveLength(LEAD_TIME_BUCKET_ORDER.length);
    expect(filled.every((entry) => entry.count === 0)).toBe(true);
  });

  it('fills zeros between min and max hits', () => {
    const filled = fillDistributionRange(
      [
        { bucket: '8-14 days', count: 1 },
        { bucket: '15-30 days', count: 7 },
      ],
      LEAD_TIME_BUCKET_ORDER
    );
    expect(filled.map((entry) => entry.bucket)).toEqual(['4-7 days', '8-14 days', '15-30 days']);
    expect(filled.map((entry) => entry.count)).toEqual([0, 1, 7]);
  });

  it('pads a single hit to at least three buckets when possible', () => {
    const filled = fillDistributionRange(
      [{ bucket: '2-3 nights', count: 8 }],
      ['1 night', '2-3 nights', '4-6 nights', '7-13 nights', '14+ nights']
    );
    expect(filled).toHaveLength(3);
    expect(filled.map((entry) => entry.bucket)).toEqual(['1 night', '2-3 nights', '4-6 nights']);
    expect(filled.map((entry) => entry.count)).toEqual([0, 8, 0]);
  });
});
