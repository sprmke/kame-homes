import { describe, expect, it } from 'vitest';

import { propertyCityLocationSlug, bookingDateToYmd, bookingParkingFindPath, absoluteBookingParkingFindUrl, bookingParkingOwnDefaultPath, absoluteBookingParkingOwnDefaultUrl } from '@/features/dashboard/bookings/lib/parkingFindPathFromBooking';

describe('propertyCityLocationSlug', () => {

  it('propertyCityLocationSlug is exported', () => {
    expect(typeof propertyCityLocationSlug).toBe('function');
  });

});

describe('bookingDateToYmd', () => {

  it('bookingDateToYmd is exported', () => {
    expect(typeof bookingDateToYmd).toBe('function');
  });

});

describe('bookingParkingFindPath', () => {

  it('bookingParkingFindPath is exported', () => {
    expect(typeof bookingParkingFindPath).toBe('function');
  });

});

describe('absoluteBookingParkingFindUrl', () => {

  it('absoluteBookingParkingFindUrl is exported', () => {
    expect(typeof absoluteBookingParkingFindUrl).toBe('function');
  });

});

describe('bookingParkingOwnDefaultPath', () => {

  it('bookingParkingOwnDefaultPath is exported', () => {
    expect(typeof bookingParkingOwnDefaultPath).toBe('function');
  });

});

describe('absoluteBookingParkingOwnDefaultUrl', () => {

  it('absoluteBookingParkingOwnDefaultUrl is exported', () => {
    expect(typeof absoluteBookingParkingOwnDefaultUrl).toBe('function');
  });

});
