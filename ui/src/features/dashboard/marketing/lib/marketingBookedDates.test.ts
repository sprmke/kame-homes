import { describe, expect, it } from 'vitest';

import { calendarPreviewThumbKey, bookedDatesToPreviewBookings, availabilityTextForMonth, openSlotDatesForMonth } from '@/features/dashboard/marketing/lib/marketingBookedDates';

describe('calendarPreviewThumbKey', () => {

  it('calendarPreviewThumbKey is exported', () => {
    expect(typeof calendarPreviewThumbKey).toBe('function');
  });

});

describe('bookedDatesToPreviewBookings', () => {

  it('bookedDatesToPreviewBookings is exported', () => {
    expect(typeof bookedDatesToPreviewBookings).toBe('function');
  });

});

describe('availabilityTextForMonth', () => {

  it('availabilityTextForMonth is exported', () => {
    expect(typeof availabilityTextForMonth).toBe('function');
  });

});

describe('openSlotDatesForMonth', () => {

  it('openSlotDatesForMonth is exported', () => {
    expect(typeof openSlotDatesForMonth).toBe('function');
  });

});
