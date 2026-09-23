import { describe, expect, it } from 'vitest';

import { getFirstBlockingCheckIn, isDateBookedForCheckoutSelection, isGuestCalendarDateDisabled, isGuestCalendarValidCheckoutDate, isGuestCalendarCheckInBlocked, clampGuestCalendarCheckoutHover, hasBlockedNightBetween, findPrecedingTurnoverBooking, findFollowingTurnoverBooking, minAllowedCheckInTime, maxAllowedCheckOutTime } from '@/features/guest/calendar/lib/guestCalendarAvailability';

describe('getFirstBlockingCheckIn', () => {

  it('getFirstBlockingCheckIn is exported', () => {
    expect(typeof getFirstBlockingCheckIn).toBe('function');
  });

});

describe('isDateBookedForCheckoutSelection', () => {

  it('isDateBookedForCheckoutSelection is exported', () => {
    expect(typeof isDateBookedForCheckoutSelection).toBe('function');
  });

});

describe('isGuestCalendarDateDisabled', () => {

  it('isGuestCalendarDateDisabled is exported', () => {
    expect(typeof isGuestCalendarDateDisabled).toBe('function');
  });

});

describe('isGuestCalendarValidCheckoutDate', () => {

  it('isGuestCalendarValidCheckoutDate is exported', () => {
    expect(typeof isGuestCalendarValidCheckoutDate).toBe('function');
  });

});

describe('isGuestCalendarCheckInBlocked', () => {

  it('isGuestCalendarCheckInBlocked is exported', () => {
    expect(typeof isGuestCalendarCheckInBlocked).toBe('function');
  });

});

describe('clampGuestCalendarCheckoutHover', () => {

  it('clampGuestCalendarCheckoutHover is exported', () => {
    expect(typeof clampGuestCalendarCheckoutHover).toBe('function');
  });

});

describe('hasBlockedNightBetween', () => {

  it('hasBlockedNightBetween is exported', () => {
    expect(typeof hasBlockedNightBetween).toBe('function');
  });

});

describe('findPrecedingTurnoverBooking', () => {

  it('findPrecedingTurnoverBooking is exported', () => {
    expect(typeof findPrecedingTurnoverBooking).toBe('function');
  });

});

describe('findFollowingTurnoverBooking', () => {

  it('findFollowingTurnoverBooking is exported', () => {
    expect(typeof findFollowingTurnoverBooking).toBe('function');
  });

});

describe('minAllowedCheckInTime', () => {

  it('minAllowedCheckInTime is exported', () => {
    expect(typeof minAllowedCheckInTime).toBe('function');
  });

});

describe('maxAllowedCheckOutTime', () => {

  it('maxAllowedCheckOutTime is exported', () => {
    expect(typeof maxAllowedCheckOutTime).toBe('function');
  });

});

