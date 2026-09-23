import { describe, expect, it } from 'vitest';

import { buildOrgNavSections, buildPropertyNavSections, buildParkingNavSections, filterOrgNavSections, filterPropertyNavSections, filterParkingNavSections, buildSuperAdminNavSections, isSuperAdminPath, isPropertyAdminPath, isParkingAdminPath, isOrgAdminPath } from '@/features/dashboard/bookings/lib/adminSidebarNav';

describe('buildOrgNavSections', () => {

  it('buildOrgNavSections is exported', () => {
    expect(typeof buildOrgNavSections).toBe('function');
  });

});

describe('buildPropertyNavSections', () => {

  it('buildPropertyNavSections is exported', () => {
    expect(typeof buildPropertyNavSections).toBe('function');
  });

});

describe('buildParkingNavSections', () => {

  it('buildParkingNavSections is exported', () => {
    expect(typeof buildParkingNavSections).toBe('function');
  });

});

describe('filterOrgNavSections', () => {

  it('filterOrgNavSections is exported', () => {
    expect(typeof filterOrgNavSections).toBe('function');
  });

});

describe('filterPropertyNavSections', () => {

  it('filterPropertyNavSections is exported', () => {
    expect(typeof filterPropertyNavSections).toBe('function');
  });

});

describe('filterParkingNavSections', () => {

  it('filterParkingNavSections is exported', () => {
    expect(typeof filterParkingNavSections).toBe('function');
  });

});

describe('buildSuperAdminNavSections', () => {

  it('buildSuperAdminNavSections is exported', () => {
    expect(typeof buildSuperAdminNavSections).toBe('function');
  });

});

describe('isSuperAdminPath', () => {

  it('isSuperAdminPath is exported', () => {
    expect(typeof isSuperAdminPath).toBe('function');
  });

});

describe('isPropertyAdminPath', () => {

  it('isPropertyAdminPath is exported', () => {
    expect(typeof isPropertyAdminPath).toBe('function');
  });

});

describe('isParkingAdminPath', () => {

  it('isParkingAdminPath is exported', () => {
    expect(typeof isParkingAdminPath).toBe('function');
  });

});

describe('isOrgAdminPath', () => {

  it('isOrgAdminPath is exported', () => {
    expect(typeof isOrgAdminPath).toBe('function');
  });

});


