import { describe, expect, it } from 'vitest';

import { parkingRoleConfig, PARKING_ROLES, PARKING_PERMISSION_CATEGORIES, PARKING_FILTER_ROLES } from '@/features/dashboard/team/lib/parkingTeamConstants';

describe('parkingRoleConfig', () => {

  it('parkingRoleConfig is exported', () => {
    expect(typeof parkingRoleConfig).toBe('function');
  });

});

describe('PARKING_ROLES', () => {
  it('is defined', () => {
    expect(PARKING_ROLES).toBeDefined();
  });
});

describe('PARKING_PERMISSION_CATEGORIES', () => {
  it('is defined', () => {
    expect(PARKING_PERMISSION_CATEGORIES).toBeDefined();
  });
});

describe('PARKING_FILTER_ROLES', () => {
  it('is defined', () => {
    expect(PARKING_FILTER_ROLES).toBeDefined();
  });
});
