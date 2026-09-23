import { describe, expect, it } from 'vitest';

import { normalizePaymentProvider, isMobileWalletProvider, formatPaymentAccountNumberDisplay, paymentAccountNumberLabel, paymentAccountNumberPlaceholder, paymentQrAltText, paymentSectionTitle, providersByGroup, paymentProviderLabel, paymentProviderGroup, isAllowedPaymentProvider, validatePaymentProvider, validatePaymentAccountName, validatePaymentAccountNumber, DEFAULT_PAYMENT_PROVIDER } from '@/features/dashboard/org/lib/paymentProviders';

describe('normalizePaymentProvider', () => {

  it('normalizePaymentProvider is exported', () => {
    expect(typeof normalizePaymentProvider).toBe('function');
  });

});

describe('isMobileWalletProvider', () => {

  it('isMobileWalletProvider is exported', () => {
    expect(typeof isMobileWalletProvider).toBe('function');
  });

});

describe('formatPaymentAccountNumberDisplay', () => {

  it('formatPaymentAccountNumberDisplay is exported', () => {
    expect(typeof formatPaymentAccountNumberDisplay).toBe('function');
  });

});

describe('paymentAccountNumberLabel', () => {

  it('paymentAccountNumberLabel is exported', () => {
    expect(typeof paymentAccountNumberLabel).toBe('function');
  });

});

describe('paymentAccountNumberPlaceholder', () => {

  it('paymentAccountNumberPlaceholder is exported', () => {
    expect(typeof paymentAccountNumberPlaceholder).toBe('function');
  });

});

describe('paymentQrAltText', () => {

  it('paymentQrAltText is exported', () => {
    expect(typeof paymentQrAltText).toBe('function');
  });

});

describe('paymentSectionTitle', () => {

  it('paymentSectionTitle is exported', () => {
    expect(typeof paymentSectionTitle).toBe('function');
  });

});

describe('providersByGroup', () => {

  it('providersByGroup is exported', () => {
    expect(typeof providersByGroup).toBe('function');
  });

});

describe('paymentProviderLabel', () => {

  it('paymentProviderLabel is exported', () => {
    expect(typeof paymentProviderLabel).toBe('function');
  });

});

describe('paymentProviderGroup', () => {

  it('paymentProviderGroup is exported', () => {
    expect(typeof paymentProviderGroup).toBe('function');
  });

});

describe('isAllowedPaymentProvider', () => {

  it('isAllowedPaymentProvider is exported', () => {
    expect(typeof isAllowedPaymentProvider).toBe('function');
  });

});

describe('validatePaymentProvider', () => {

  it('validatePaymentProvider is exported', () => {
    expect(typeof validatePaymentProvider).toBe('function');
  });

});

describe('validatePaymentAccountName', () => {

  it('validatePaymentAccountName is exported', () => {
    expect(typeof validatePaymentAccountName).toBe('function');
  });

});

describe('validatePaymentAccountNumber', () => {

  it('validatePaymentAccountNumber is exported', () => {
    expect(typeof validatePaymentAccountNumber).toBe('function');
  });

});

describe('DEFAULT_PAYMENT_PROVIDER', () => {
  it('is defined', () => {
    expect(DEFAULT_PAYMENT_PROVIDER).toBeDefined();
  });
});



