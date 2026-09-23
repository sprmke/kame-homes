import { describe, expect, it } from 'vitest';

import { isPercentOffVoucher, voucherLiabilityPhp, isStaycationVoucher, formatVoucherPrizeLabel, formatVoucherDiscountMaxLabel, voucherReelPool, pickPreWinnerTeasers, findVoucher, prizesToVouchers, VOUCHER_DISCOUNT_MAX_PERCENT, VOUCHER_REEL_POOL } from '@/features/guest/sd-form/lib/voucher';

describe('isPercentOffVoucher', () => {

  it('isPercentOffVoucher is exported', () => {
    expect(typeof isPercentOffVoucher).toBe('function');
  });

});

describe('voucherLiabilityPhp', () => {

  it('voucherLiabilityPhp is exported', () => {
    expect(typeof voucherLiabilityPhp).toBe('function');
  });

});

describe('isStaycationVoucher', () => {

  it('isStaycationVoucher is exported', () => {
    expect(typeof isStaycationVoucher).toBe('function');
  });

});

describe('formatVoucherPrizeLabel', () => {

  it('formatVoucherPrizeLabel is exported', () => {
    expect(typeof formatVoucherPrizeLabel).toBe('function');
  });

});

describe('formatVoucherDiscountMaxLabel', () => {

  it('formatVoucherDiscountMaxLabel is exported', () => {
    expect(typeof formatVoucherDiscountMaxLabel).toBe('function');
  });

});

describe('voucherReelPool', () => {

  it('voucherReelPool is exported', () => {
    expect(typeof voucherReelPool).toBe('function');
  });

});

describe('pickPreWinnerTeasers', () => {

  it('pickPreWinnerTeasers is exported', () => {
    expect(typeof pickPreWinnerTeasers).toBe('function');
  });

});

describe('findVoucher', () => {

  it('findVoucher is exported', () => {
    expect(typeof findVoucher).toBe('function');
  });

});

describe('prizesToVouchers', () => {

  it('prizesToVouchers is exported', () => {
    expect(typeof prizesToVouchers).toBe('function');
  });

});

describe('VOUCHER_DISCOUNT_MAX_PERCENT', () => {
  it('is defined', () => {
    expect(VOUCHER_DISCOUNT_MAX_PERCENT).toBeDefined();
  });
});

describe('VOUCHER_REEL_POOL', () => {
  it('is defined', () => {
    expect(VOUCHER_REEL_POOL).toBeDefined();
  });
});
