import { describe, expect, it } from 'vitest';

import { createEmptyPaymentMethod, paymentMethodsFromLegacyFields, normalizePaymentMethodsDraft, primaryPaymentMethod, setPrimaryPaymentMethod, setPaymentMethodQrUrl, setPrimaryPaymentMethodQrUrl, validatePaymentMethods, resolvePaymentMethodFieldError, paymentMethodEditorFieldIds, clonePaymentMethods, syncLegacyPaymentFieldsFromMethods, paymentMethodsEqual, paymentMethodsDraftIsDirty, MAX_PROPERTY_PAYMENT_METHODS } from '@/features/dashboard/org/lib/paymentMethods';

describe('createEmptyPaymentMethod', () => {

  it('createEmptyPaymentMethod is exported', () => {
    expect(typeof createEmptyPaymentMethod).toBe('function');
  });

});

describe('paymentMethodsFromLegacyFields', () => {

  it('paymentMethodsFromLegacyFields is exported', () => {
    expect(typeof paymentMethodsFromLegacyFields).toBe('function');
  });

});

describe('normalizePaymentMethodsDraft', () => {

  it('normalizePaymentMethodsDraft is exported', () => {
    expect(typeof normalizePaymentMethodsDraft).toBe('function');
  });

});

describe('primaryPaymentMethod', () => {

  it('primaryPaymentMethod is exported', () => {
    expect(typeof primaryPaymentMethod).toBe('function');
  });

});

describe('setPrimaryPaymentMethod', () => {

  it('setPrimaryPaymentMethod is exported', () => {
    expect(typeof setPrimaryPaymentMethod).toBe('function');
  });

});

describe('setPaymentMethodQrUrl', () => {

  it('setPaymentMethodQrUrl is exported', () => {
    expect(typeof setPaymentMethodQrUrl).toBe('function');
  });

});

describe('setPrimaryPaymentMethodQrUrl', () => {

  it('setPrimaryPaymentMethodQrUrl is exported', () => {
    expect(typeof setPrimaryPaymentMethodQrUrl).toBe('function');
  });

});

describe('validatePaymentMethods', () => {

  it('validatePaymentMethods is exported', () => {
    expect(typeof validatePaymentMethods).toBe('function');
  });

});

describe('resolvePaymentMethodFieldError', () => {

  it('resolvePaymentMethodFieldError is exported', () => {
    expect(typeof resolvePaymentMethodFieldError).toBe('function');
  });

});

describe('paymentMethodEditorFieldIds', () => {

  it('paymentMethodEditorFieldIds is exported', () => {
    expect(typeof paymentMethodEditorFieldIds).toBe('function');
  });

});

describe('clonePaymentMethods', () => {

  it('clonePaymentMethods is exported', () => {
    expect(typeof clonePaymentMethods).toBe('function');
  });

});

describe('syncLegacyPaymentFieldsFromMethods', () => {

  it('syncLegacyPaymentFieldsFromMethods is exported', () => {
    expect(typeof syncLegacyPaymentFieldsFromMethods).toBe('function');
  });

});

describe('paymentMethodsEqual', () => {

  it('paymentMethodsEqual is exported', () => {
    expect(typeof paymentMethodsEqual).toBe('function');
  });

});

describe('paymentMethodsDraftIsDirty', () => {

  it('paymentMethodsDraftIsDirty is exported', () => {
    expect(typeof paymentMethodsDraftIsDirty).toBe('function');
  });

});

describe('MAX_PROPERTY_PAYMENT_METHODS', () => {
  it('is defined', () => {
    expect(MAX_PROPERTY_PAYMENT_METHODS).toBeDefined();
  });
});
