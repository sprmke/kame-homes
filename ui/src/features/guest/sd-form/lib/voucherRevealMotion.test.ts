import { describe, expect, it } from 'vitest';

import { prefersReducedMotion, usePrefersReducedMotion } from '@/features/guest/sd-form/lib/voucherRevealMotion';

describe('prefersReducedMotion', () => {

  it('prefersReducedMotion is exported', () => {
    expect(typeof prefersReducedMotion).toBe('function');
  });

});

describe('usePrefersReducedMotion', () => {

  it('usePrefersReducedMotion is exported', () => {
    expect(typeof usePrefersReducedMotion).toBe('function');
  });

});
