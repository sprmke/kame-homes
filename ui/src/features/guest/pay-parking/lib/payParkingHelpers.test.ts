import { describe, expect, it } from 'vitest';

import { parseBookingStayDate, bookingDateToMmDdYyyy, countParkingNights, defaultParkingDateRange, parkingUsesBookingStayDates, bookingStayDateRange, bookingStayNights, canCustomizeParkingDates, defaultParkingCheckOutAfterCheckIn, isLastMinutePayParkingRequest, hasPayParkingAvailed, defaultParkingRateGuest } from '@/features/guest/pay-parking/lib/payParkingHelpers';

describe('parseBookingStayDate', () => {

  it('parseBookingStayDate is exported', () => {
    expect(typeof parseBookingStayDate).toBe('function');
  });

});

describe('bookingDateToMmDdYyyy', () => {

  it('bookingDateToMmDdYyyy is exported', () => {
    expect(typeof bookingDateToMmDdYyyy).toBe('function');
  });

});

describe('countParkingNights', () => {

  it('countParkingNights is exported', () => {
    expect(typeof countParkingNights).toBe('function');
  });

});

describe('defaultParkingDateRange', () => {

  it('defaultParkingDateRange is exported', () => {
    expect(typeof defaultParkingDateRange).toBe('function');
  });

});

describe('parkingUsesBookingStayDates', () => {

  it('parkingUsesBookingStayDates is exported', () => {
    expect(typeof parkingUsesBookingStayDates).toBe('function');
  });

});

describe('bookingStayDateRange', () => {

  it('bookingStayDateRange is exported', () => {
    expect(typeof bookingStayDateRange).toBe('function');
  });

});

describe('bookingStayNights', () => {

  it('bookingStayNights is exported', () => {
    expect(typeof bookingStayNights).toBe('function');
  });

});

describe('canCustomizeParkingDates', () => {

  it('canCustomizeParkingDates is exported', () => {
    expect(typeof canCustomizeParkingDates).toBe('function');
  });

});

describe('defaultParkingCheckOutAfterCheckIn', () => {

  it('defaultParkingCheckOutAfterCheckIn is exported', () => {
    expect(typeof defaultParkingCheckOutAfterCheckIn).toBe('function');
  });

});

describe('isLastMinutePayParkingRequest', () => {

  it('isLastMinutePayParkingRequest is exported', () => {
    expect(typeof isLastMinutePayParkingRequest).toBe('function');
  });

});

describe('hasPayParkingAvailed', () => {

  it('hasPayParkingAvailed is exported', () => {
    expect(typeof hasPayParkingAvailed).toBe('function');
  });

});

describe('defaultParkingRateGuest', () => {

  it('defaultParkingRateGuest is exported', () => {
    expect(typeof defaultParkingRateGuest).toBe('function');
  });

});
