import { describe, expect, it } from 'vitest';

import { PeakAccumulator } from '@/features/dashboard/marketing/lib/media/peaks';

describe('PeakAccumulator', () => {
  it('maps samples to time buckets across chunks and channels', () => {
    const acc = new PeakAccumulator(4, 4);
    // 1 sample per second, 4 s: loud second sample only in the right channel.
    acc.add(
      [
        [0.1, 0.2],
        [0, 0.8],
      ],
      0,
      1
    );
    acc.add(
      [
        [0.4, 0.4],
        [0, 0],
      ],
      2,
      1
    );
    expect(acc.result()).toEqual([0.125, 1, 0.5, 0.5]);
  });

  it('is empty-safe', () => {
    expect(new PeakAccumulator(10, 3).result()).toEqual([0, 0, 0]);
    const acc = new PeakAccumulator(0, 3);
    acc.add([[1]], 0, 1);
    expect(acc.result()).toEqual([0, 0, 0]);
  });

  it('clamps out-of-range timestamps into the first and last bucket', () => {
    const acc = new PeakAccumulator(2, 2);
    acc.add([[0.5]], -5, 1);
    acc.add([[1]], 99, 1);
    expect(acc.result()).toEqual([0.5, 1]);
  });
});
