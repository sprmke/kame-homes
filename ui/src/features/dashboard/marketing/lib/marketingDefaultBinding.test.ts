import { describe, expect, it } from 'vitest';

import { resolveMarketingThumbBinding, MARKETING_THUMB_STOCK_PHOTOS, DEFAULT_MARKETING_THUMB_PROPERTY_NAME } from '@/features/dashboard/marketing/lib/marketingDefaultBinding';

describe('resolveMarketingThumbBinding', () => {

  it('resolveMarketingThumbBinding is exported', () => {
    expect(typeof resolveMarketingThumbBinding).toBe('function');
  });

});

describe('MARKETING_THUMB_STOCK_PHOTOS', () => {
  it('is defined', () => {
    expect(MARKETING_THUMB_STOCK_PHOTOS).toBeDefined();
  });
});

describe('DEFAULT_MARKETING_THUMB_PROPERTY_NAME', () => {
  it('is defined', () => {
    expect(DEFAULT_MARKETING_THUMB_PROPERTY_NAME).toBeDefined();
  });
});
