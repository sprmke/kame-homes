import { describe, expect, it } from 'vitest';

import { usePropertyIdParam, useParkingIdParam, useOrgSlugParam, useOrgIdParam, useResolvedOrgId, useOrgScopeKey, appendPropertyId, appendParkingId, adminApiPath, scopedAdminPath, scopedFunctionsUrl, appendOrgId, scopedOrgFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';

describe('usePropertyIdParam', () => {

  it('usePropertyIdParam is exported', () => {
    expect(typeof usePropertyIdParam).toBe('function');
  });

});

describe('useParkingIdParam', () => {

  it('useParkingIdParam is exported', () => {
    expect(typeof useParkingIdParam).toBe('function');
  });

});

describe('useOrgSlugParam', () => {

  it('useOrgSlugParam is exported', () => {
    expect(typeof useOrgSlugParam).toBe('function');
  });

});

describe('useOrgIdParam', () => {

  it('useOrgIdParam is exported', () => {
    expect(typeof useOrgIdParam).toBe('function');
  });

});

describe('useResolvedOrgId', () => {

  it('useResolvedOrgId is exported', () => {
    expect(typeof useResolvedOrgId).toBe('function');
  });

});

describe('useOrgScopeKey', () => {

  it('useOrgScopeKey is exported', () => {
    expect(typeof useOrgScopeKey).toBe('function');
  });

});

describe('appendPropertyId', () => {

  it('appendPropertyId is exported', () => {
    expect(typeof appendPropertyId).toBe('function');
  });

});

describe('appendParkingId', () => {

  it('appendParkingId is exported', () => {
    expect(typeof appendParkingId).toBe('function');
  });

});

describe('adminApiPath', () => {

  it('adminApiPath is exported', () => {
    expect(typeof adminApiPath).toBe('function');
  });

});

describe('scopedAdminPath', () => {

  it('scopedAdminPath is exported', () => {
    expect(typeof scopedAdminPath).toBe('function');
  });

});

describe('scopedFunctionsUrl', () => {

  it('scopedFunctionsUrl is exported', () => {
    expect(typeof scopedFunctionsUrl).toBe('function');
  });

});

describe('appendOrgId', () => {

  it('appendOrgId is exported', () => {
    expect(typeof appendOrgId).toBe('function');
  });

});

describe('scopedOrgFunctionsUrl', () => {

  it('scopedOrgFunctionsUrl is exported', () => {
    expect(typeof scopedOrgFunctionsUrl).toBe('function');
  });

});
