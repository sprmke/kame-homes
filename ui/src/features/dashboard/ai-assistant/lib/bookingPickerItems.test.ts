import { describe, expect, it } from 'vitest';

import { bookingGuestName, bookingStayRange, bookingRowLabel, bookingSearchHaystack, groupByCheckInMonth } from '@/features/dashboard/ai-assistant/lib/bookingPickerItems';

describe('bookingGuestName', () => {

  it('bookingGuestName is exported', () => {
    expect(typeof bookingGuestName).toBe('function');
  });

});

describe('bookingStayRange', () => {

  it('bookingStayRange is exported', () => {
    expect(typeof bookingStayRange).toBe('function');
  });

});

describe('bookingRowLabel', () => {

  it('bookingRowLabel is exported', () => {
    expect(typeof bookingRowLabel).toBe('function');
  });

});

describe('bookingSearchHaystack', () => {

  it('bookingSearchHaystack is exported', () => {
    expect(typeof bookingSearchHaystack).toBe('function');
  });

});

describe('groupByCheckInMonth', () => {

  it('groupByCheckInMonth is exported', () => {
    expect(typeof groupByCheckInMonth).toBe('function');
  });

});
