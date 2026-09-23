import { describe, expect, it } from 'vitest';

import { isPlatformSeedMediaUrl, storedAppSettingsMediaUrl, storedOrgSettingsMediaUrl, resolvePaymentMethodQrDisplayUrl, resolvePrimaryPaymentQrDisplayUrl, legacyGcashQrForPaymentMethods } from '@/features/dashboard/lib/storedMediaDisplay';

describe('isPlatformSeedMediaUrl', () => {

  it('isPlatformSeedMediaUrl is exported', () => {
    expect(typeof isPlatformSeedMediaUrl).toBe('function');
  });

});

describe('storedAppSettingsMediaUrl', () => {

  it('storedAppSettingsMediaUrl is exported', () => {
    expect(typeof storedAppSettingsMediaUrl).toBe('function');
  });

});

describe('storedOrgSettingsMediaUrl', () => {

  it('storedOrgSettingsMediaUrl is exported', () => {
    expect(typeof storedOrgSettingsMediaUrl).toBe('function');
  });

});

describe('resolvePaymentMethodQrDisplayUrl', () => {

  it('resolvePaymentMethodQrDisplayUrl is exported', () => {
    expect(typeof resolvePaymentMethodQrDisplayUrl).toBe('function');
  });

});

describe('resolvePrimaryPaymentQrDisplayUrl', () => {

  it('resolvePrimaryPaymentQrDisplayUrl is exported', () => {
    expect(typeof resolvePrimaryPaymentQrDisplayUrl).toBe('function');
  });

});

describe('legacyGcashQrForPaymentMethods', () => {

  it('legacyGcashQrForPaymentMethods is exported', () => {
    expect(typeof legacyGcashQrForPaymentMethods).toBe('function');
  });

});
