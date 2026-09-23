import { describe, expect, it } from 'vitest';

import { buildHostNetBreakdown, financeDisplayNet, hostNetToneClass, computeBookingFinancials } from '@/features/dashboard/bookings/lib/bookingFinance';

describe('buildHostNetBreakdown', () => {

  it('buildHostNetBreakdown is exported', () => {
    expect(typeof buildHostNetBreakdown).toBe('function');
  });

});

describe('financeDisplayNet', () => {

  it('financeDisplayNet is exported', () => {
    expect(typeof financeDisplayNet).toBe('function');
  });

});

describe('hostNetToneClass', () => {

  it('hostNetToneClass is exported', () => {
    expect(typeof hostNetToneClass).toBe('function');
  });

});

describe('computeBookingFinancials', () => {

  it('computeBookingFinancials is exported', () => {
    expect(typeof computeBookingFinancials).toBe('function');
  });

});
