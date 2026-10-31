import { describe, expect, it } from 'vitest';

import { wheelTargetRotationDeg } from '@/features/guest/sd-form/components/voucher-reveal/VoucherRevealWheel';

describe('wheelTargetRotationDeg', () => {
  it('returns zero for empty segment count', () => {
    expect(wheelTargetRotationDeg(0, 0)).toBe(0);
  });

  it('lands segment 0 under the top pointer after full spins', () => {
    const target = wheelTargetRotationDeg(4, 0);
    expect(target % 360).toBeCloseTo(315, 5);
    expect(target).toBeGreaterThanOrEqual(5 * 360);
  });

  it('advances target when winner index increases', () => {
    const four = wheelTargetRotationDeg(4, 2);
    const zero = wheelTargetRotationDeg(4, 0);
    expect(four).toBeLessThan(zero);
  });

  it('uses equal slice angles for any segment count', () => {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const mod = wheelTargetRotationDeg(n, i) % 360;
      expect(mod).toBeGreaterThanOrEqual(0);
      expect(mod).toBeLessThan(360);
    }
  });
});
