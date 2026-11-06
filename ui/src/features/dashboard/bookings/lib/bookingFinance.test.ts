import { describe, expect, it } from 'vitest';

import {
  buildHostNetBreakdown,
  financeDisplayNet,
  hostNetToneClass,
  computeBookingFinancials,
  type BookingFinanceInput,
} from '@/features/dashboard/bookings/lib/bookingFinance';

describe('buildHostNetBreakdown', () => {
  it('buildHostNetBreakdown is exported', () => {
    expect(typeof buildHostNetBreakdown).toBe('function');
  });

  it('Airbnb reports the booking rate instead of a down payment', () => {
    const booking = {
      status: 'READY_FOR_CHECKIN',
      booking_source: 'Airbnb',
      booking_rate: 10000,
      down_payment: 0,
      balance: 10000,
      security_deposit: 0,
      has_pets: false,
      need_parking: false,
    } as BookingFinanceInput;

    expect(buildHostNetBreakdown(booking, false).income).toEqual([
      { key: 'booking_rate', label: 'Booking rate', amount: 10000 },
    ]);
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
