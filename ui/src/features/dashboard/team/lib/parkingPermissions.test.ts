import { describe, expect, it } from 'vitest';

import { hasParkingPermission, PARKING_SECTION_VIEW_PERMISSION } from '@/features/dashboard/team/lib/parkingPermissions';

describe('hasParkingPermission', () => {

  it('hasParkingPermission is exported', () => {
    expect(typeof hasParkingPermission).toBe('function');
  });

});

describe('PARKING_SECTION_VIEW_PERMISSION', () => {
  it('is defined', () => {
    expect(PARKING_SECTION_VIEW_PERMISSION).toBeDefined();
  });
});
