import { describe, expect, it } from 'vitest';

import {
  BOOKING_EDIT_TAB_PERMISSION,
  bookingEditableTabs,
  hasAnyBookingDetailEditPermission,
  hasPropertyPermission,
  hasPropertyTeamManageAccess,
  SETTINGS_SECTION_EDIT_PERMISSION,
} from '@/features/dashboard/team/lib/propertyPermissions';

describe('hasPropertyPermission', () => {
  it('returns false when permissions missing or empty', () => {
    expect(hasPropertyPermission(undefined, 'bookings:view')).toBe(false);
    expect(hasPropertyPermission([], 'bookings:view')).toBe(false);
  });

  it('returns true when expanded permissions include the leaf', () => {
    expect(hasPropertyPermission(['bookings:view'], 'bookings:view')).toBe(true);
    expect(hasPropertyPermission(['bookings:view'], 'finance:view')).toBe(false);
  });
});

describe('hasAnyBookingDetailEditPermission', () => {
  it('requires a booking detail edit leaf', () => {
    expect(hasAnyBookingDetailEditPermission(['bookings:view'])).toBe(false);
    expect(hasAnyBookingDetailEditPermission(['bookings.detail.stay:edit'])).toBe(true);
  });
});

describe('hasPropertyTeamManageAccess', () => {
  it('is true for member or custom-role mutations', () => {
    expect(hasPropertyTeamManageAccess(['team.members:edit'])).toBe(true);
    expect(hasPropertyTeamManageAccess(['team:view'])).toBe(false);
  });
});

describe('bookingEditableTabs', () => {
  it('lists tabs the member can edit', () => {
    expect(
      bookingEditableTabs(['bookings.detail.guests:edit', 'bookings.detail.pets:edit'])
    ).toEqual(['guest', 'pets']);
    expect(bookingEditableTabs([])).toEqual([]);
  });
});

describe('permission maps', () => {
  it('maps stay tab to stay edit leaf', () => {
    expect(BOOKING_EDIT_TAB_PERMISSION.stay).toBe('bookings.detail.stay:edit');
  });

  it('integrations settings section is view-only', () => {
    expect(SETTINGS_SECTION_EDIT_PERMISSION.integrations).toBeNull();
  });
});
