import { describe, expect, it } from 'vitest';

import { resolveVoucherPercentOff, computePercentDiscountPhp, formatVoucherOfferLabel } from '@/features/guest/account/lib/voucherDiscount';

describe('resolveVoucherPercentOff', () => {

  it('resolveVoucherPercentOff is exported', () => {
    expect(typeof resolveVoucherPercentOff).toBe('function');
  });

});

describe('computePercentDiscountPhp', () => {

  it('computePercentDiscountPhp is exported', () => {
    expect(typeof computePercentDiscountPhp).toBe('function');
  });

});

describe('formatVoucherOfferLabel', () => {

  it('formatVoucherOfferLabel is exported', () => {
    expect(typeof formatVoucherOfferLabel).toBe('function');
  });

});
