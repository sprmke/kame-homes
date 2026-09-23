import { describe, expect, it } from 'vitest';

import { isPropertyOnlyOrgAccess, canSelectOrgInSwitcher, canCreatePropertiesInOrg, canCreateParkingsInOrg, canManageOrgBilling } from '@/features/dashboard/org/lib/orgAccessKind';

describe('isPropertyOnlyOrgAccess', () => {

  it('isPropertyOnlyOrgAccess is exported', () => {
    expect(typeof isPropertyOnlyOrgAccess).toBe('function');
  });

});

describe('canSelectOrgInSwitcher', () => {

  it('canSelectOrgInSwitcher is exported', () => {
    expect(typeof canSelectOrgInSwitcher).toBe('function');
  });

});

describe('canCreatePropertiesInOrg', () => {

  it('canCreatePropertiesInOrg is exported', () => {
    expect(typeof canCreatePropertiesInOrg).toBe('function');
  });

});

describe('canCreateParkingsInOrg', () => {

  it('canCreateParkingsInOrg is exported', () => {
    expect(typeof canCreateParkingsInOrg).toBe('function');
  });

});

describe('canManageOrgBilling', () => {

  it('canManageOrgBilling is exported', () => {
    expect(typeof canManageOrgBilling).toBe('function');
  });

});
