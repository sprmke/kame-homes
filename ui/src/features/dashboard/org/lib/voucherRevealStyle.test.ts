import { describe, expect, it } from 'vitest';

import { isVoucherRevealStyle, normalizeVoucherRevealStyle, voucherRevealStyleLabel } from '@/features/dashboard/org/lib/voucherRevealStyle';

describe('isVoucherRevealStyle', () => {

  it('isVoucherRevealStyle is exported', () => {
    expect(typeof isVoucherRevealStyle).toBe('function');
  });

});

describe('normalizeVoucherRevealStyle', () => {

  it('normalizeVoucherRevealStyle is exported', () => {
    expect(typeof normalizeVoucherRevealStyle).toBe('function');
  });

});

describe('voucherRevealStyleLabel', () => {

  it('voucherRevealStyleLabel is exported', () => {
    expect(typeof voucherRevealStyleLabel).toBe('function');
  });

});
