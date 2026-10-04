import { describe, expect, it } from 'vitest';

import type { BookingParkingShareLink } from '@/features/dashboard/bookings/hooks/useBookingParkingShareLink';
import type { BookingStayGuideLink } from '@/features/dashboard/bookings/hooks/useBookingStayGuideLink';
import { buildBookingDetailActions } from '@/features/dashboard/bookings/lib/bookingDetailActions';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

const noop = () => {};

const parkingShareLink: BookingParkingShareLink = {
  url: '',
  searchUrl: '',
  isOwnDefault: false,
  open: noop,
  copy: noop,
  openSearch: noop,
  copySearch: noop,
};

function stayGuide(overrides: Partial<BookingStayGuideLink>): BookingStayGuideLink {
  return {
    url: '',
    pending: false,
    locked: false,
    open: noop,
    copy: noop,
    upgrade: noop,
    ...overrides,
  };
}

function actionKeys(guide: BookingStayGuideLink): string[] {
  return buildBookingDetailActions({
    booking: { status: 'READY_FOR_CHECKIN' } as BookingRow,
    onEdit: noop,
    onFindParking: noop,
    stayGuide: guide,
    parkingShareLink,
    canEditParking: false,
    canEditPets: false,
    canManagePayParking: false,
  }).map((action) => action.key);
}

describe('buildBookingDetailActions stay guide', () => {
  it('offers open and copy when the plan includes the stay guide', () => {
    expect(actionKeys(stayGuide({ url: 'https://example.test/guide' }))).toEqual([
      'stay-guide-open',
      'stay-guide-copy',
    ]);
  });

  it('offers one upgrade row with the plan pill below Pro', () => {
    const actions = buildBookingDetailActions({
      booking: { status: 'READY_FOR_CHECKIN' } as BookingRow,
      onEdit: noop,
      onFindParking: noop,
      stayGuide: stayGuide({ locked: true }),
      parkingShareLink,
      canEditParking: false,
      canEditPets: false,
      canManagePayParking: false,
    });
    expect(actions.map((action) => action.key)).toEqual(['stay-guide-upgrade']);
    expect(actions[0]?.planFeature).toBe('propertyShowcase');
  });
});
