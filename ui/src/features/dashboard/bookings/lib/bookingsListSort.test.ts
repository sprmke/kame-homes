import { describe, expect, it } from 'vitest';

import { checkInDateToIso, matchesDefaultBookingsListVisibility, manilaTodayIso, passesListCheckInDateRangeFilter, compareBookingsForListSort, nextStaySort, isStaySort } from '@/features/dashboard/bookings/lib/bookingsListSort';

describe('checkInDateToIso', () => {

  it('checkInDateToIso is exported', () => {
    expect(typeof checkInDateToIso).toBe('function');
  });

});

describe('matchesDefaultBookingsListVisibility', () => {

  it('matchesDefaultBookingsListVisibility is exported', () => {
    expect(typeof matchesDefaultBookingsListVisibility).toBe('function');
  });

});

describe('manilaTodayIso', () => {

  it('manilaTodayIso is exported', () => {
    expect(typeof manilaTodayIso).toBe('function');
  });

});

describe('passesListCheckInDateRangeFilter', () => {

  it('passesListCheckInDateRangeFilter is exported', () => {
    expect(typeof passesListCheckInDateRangeFilter).toBe('function');
  });

});

describe('compareBookingsForListSort', () => {

  it('compareBookingsForListSort is exported', () => {
    expect(typeof compareBookingsForListSort).toBe('function');
  });

});

describe('nextStaySort', () => {

  it('nextStaySort is exported', () => {
    expect(typeof nextStaySort).toBe('function');
  });

});

describe('isStaySort', () => {

  it('isStaySort is exported', () => {
    expect(typeof isStaySort).toBe('function');
  });

});
