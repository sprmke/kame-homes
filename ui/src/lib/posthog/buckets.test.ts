import { describe, expect, it } from 'vitest';

import { amountBucketPhp } from './buckets';

describe('amountBucketPhp', () => {
  it('buckets at 1k / 5k / 20k', () => {
    expect(amountBucketPhp(0)).toBe('<1k');
    expect(amountBucketPhp(999)).toBe('<1k');
    expect(amountBucketPhp(1000)).toBe('1k-5k');
    expect(amountBucketPhp(4999)).toBe('1k-5k');
    expect(amountBucketPhp(5000)).toBe('5k-20k');
    expect(amountBucketPhp(19999)).toBe('5k-20k');
    expect(amountBucketPhp(20000)).toBe('20k+');
  });

  it('never throws on a bad amount', () => {
    expect(amountBucketPhp(Number.NaN)).toBe('<1k');
    expect(amountBucketPhp(-5)).toBe('<1k');
  });
});
