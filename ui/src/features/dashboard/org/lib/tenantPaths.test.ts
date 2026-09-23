import { describe, expect, it } from 'vitest';

import { getLastOrgSlug, getLastPropertySlug, getLastParkingSlug, getLastTenantKind, setLastTenantContext, setLastParkingContext, orgBookingsPath, orgDashboardPath, orgPropertiesPath, orgSettingsPath, orgTeamPath, orgPlansPath, orgInboxPath, propertyInboxPath, parkingInboxPath, orgParkingsPath, parkingDashboardPath, parkingSectionPath, propertyDashboardPath, propertySectionPath, parkingNotificationsPath, propertyNotificationsPath, bookingDetailPath, parkingBookingDetailPath } from '@/features/dashboard/org/lib/tenantPaths';

describe('getLastOrgSlug', () => {

  it('getLastOrgSlug is exported', () => {
    expect(typeof getLastOrgSlug).toBe('function');
  });

});

describe('getLastPropertySlug', () => {

  it('getLastPropertySlug is exported', () => {
    expect(typeof getLastPropertySlug).toBe('function');
  });

});

describe('getLastParkingSlug', () => {

  it('getLastParkingSlug is exported', () => {
    expect(typeof getLastParkingSlug).toBe('function');
  });

});

describe('getLastTenantKind', () => {

  it('getLastTenantKind is exported', () => {
    expect(typeof getLastTenantKind).toBe('function');
  });

});

describe('setLastTenantContext', () => {

  it('setLastTenantContext is exported', () => {
    expect(typeof setLastTenantContext).toBe('function');
  });

});

describe('setLastParkingContext', () => {

  it('setLastParkingContext is exported', () => {
    expect(typeof setLastParkingContext).toBe('function');
  });

});

describe('orgBookingsPath', () => {

  it('orgBookingsPath is exported', () => {
    expect(typeof orgBookingsPath).toBe('function');
  });

});

describe('orgDashboardPath', () => {

  it('orgDashboardPath is exported', () => {
    expect(typeof orgDashboardPath).toBe('function');
  });

});

describe('orgPropertiesPath', () => {

  it('orgPropertiesPath is exported', () => {
    expect(typeof orgPropertiesPath).toBe('function');
  });

});

describe('orgSettingsPath', () => {

  it('orgSettingsPath is exported', () => {
    expect(typeof orgSettingsPath).toBe('function');
  });

});

describe('orgTeamPath', () => {

  it('orgTeamPath is exported', () => {
    expect(typeof orgTeamPath).toBe('function');
  });

});

describe('orgPlansPath', () => {

  it('orgPlansPath is exported', () => {
    expect(typeof orgPlansPath).toBe('function');
  });

});

describe('orgInboxPath', () => {

  it('orgInboxPath is exported', () => {
    expect(typeof orgInboxPath).toBe('function');
  });

});

describe('propertyInboxPath', () => {

  it('propertyInboxPath is exported', () => {
    expect(typeof propertyInboxPath).toBe('function');
  });

});

describe('parkingInboxPath', () => {

  it('parkingInboxPath is exported', () => {
    expect(typeof parkingInboxPath).toBe('function');
  });

});

describe('orgParkingsPath', () => {

  it('orgParkingsPath is exported', () => {
    expect(typeof orgParkingsPath).toBe('function');
  });

});

describe('parkingDashboardPath', () => {

  it('parkingDashboardPath is exported', () => {
    expect(typeof parkingDashboardPath).toBe('function');
  });

});

describe('parkingSectionPath', () => {

  it('parkingSectionPath is exported', () => {
    expect(typeof parkingSectionPath).toBe('function');
  });

});

describe('propertyDashboardPath', () => {

  it('propertyDashboardPath is exported', () => {
    expect(typeof propertyDashboardPath).toBe('function');
  });

});

describe('propertySectionPath', () => {

  it('propertySectionPath is exported', () => {
    expect(typeof propertySectionPath).toBe('function');
  });

});

describe('parkingNotificationsPath', () => {

  it('parkingNotificationsPath is exported', () => {
    expect(typeof parkingNotificationsPath).toBe('function');
  });

});

describe('propertyNotificationsPath', () => {

  it('propertyNotificationsPath is exported', () => {
    expect(typeof propertyNotificationsPath).toBe('function');
  });

});

describe('bookingDetailPath', () => {

  it('bookingDetailPath is exported', () => {
    expect(typeof bookingDetailPath).toBe('function');
  });

});

describe('parkingBookingDetailPath', () => {

  it('parkingBookingDetailPath is exported', () => {
    expect(typeof parkingBookingDetailPath).toBe('function');
  });

});
