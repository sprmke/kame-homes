import { describe, expect, it } from 'vitest';

import { useParkingIdParam, appendParkingId, scopedParkingFunctionsUrl, scopedParkingFunctionsBaseUrl } from '@/features/dashboard/org/lib/adminParkingScope';

describe('useParkingIdParam', () => {

  it('useParkingIdParam is exported', () => {
    expect(typeof useParkingIdParam).toBe('function');
  });

});

describe('appendParkingId', () => {

  it('appendParkingId is exported', () => {
    expect(typeof appendParkingId).toBe('function');
  });

});

describe('scopedParkingFunctionsUrl', () => {

  it('scopedParkingFunctionsUrl is exported', () => {
    expect(typeof scopedParkingFunctionsUrl).toBe('function');
  });

});

describe('scopedParkingFunctionsBaseUrl', () => {

  it('scopedParkingFunctionsBaseUrl is exported', () => {
    expect(typeof scopedParkingFunctionsBaseUrl).toBe('function');
  });

});
