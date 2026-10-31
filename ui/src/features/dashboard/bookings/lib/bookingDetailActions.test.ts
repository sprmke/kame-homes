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

describe('buildBookingDetailActions guest trip link', () => {
  const base = {
    booking: { status: 'PENDING_REVIEW' } as BookingRow,
    onEdit: noop,
    onFindParking: noop,
    stayGuide: stayGuide({}),
    parkingShareLink,
    canEditParking: false,
    canEditPets: false,
    canManagePayParking: false,
  };

  it('offers open and copy once the link has loaded, ahead of the stay guide', () => {
    const keys = buildBookingDetailActions({
      ...base,
      stayGuide: stayGuide({ url: 'https://example.test/guide' }),
      tripLink: { url: 'https://example.test/trip', open: noop, copy: noop },
    }).map((action) => action.key);
    expect(keys).toEqual(['trip-open', 'trip-copy', 'stay-guide-open', 'stay-guide-copy']);
  });

  it('hides the rows while the link is loading', () => {
    const keys = buildBookingDetailActions({
      ...base,
      tripLink: { url: '', open: noop, copy: noop },
    }).map((action) => action.key);
    expect(keys).toEqual([]);
  });
});
