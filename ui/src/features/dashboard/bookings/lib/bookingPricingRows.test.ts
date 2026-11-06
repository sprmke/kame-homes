import { describe, expect, it } from 'vitest';

import { buildBookingRateRows } from '@/features/dashboard/bookings/lib/bookingPricingRows';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

const baseBooking = {
  booking_source: 'Facebook',
  booking_rate: 10000,
  down_payment: 2000,
  balance: 8000,
  security_deposit: 3000,
  has_pets: false,
  pet_fee: 0,
  guest_additional_fee: 0,
} as Pick<
  BookingRow,
  | 'booking_source'
  | 'booking_rate'
  | 'down_payment'
  | 'balance'
  | 'security_deposit'
  | 'has_pets'
  | 'pet_fee'
  | 'guest_additional_fee'
>;

describe('buildBookingRateRows', () => {
  it('lists down payment, balance, and security deposit for a direct booking', () => {
    expect(buildBookingRateRows(baseBooking)).toEqual([
      { key: 'rate', label: 'Booking rate', value: '₱10,000.00' },
      { key: 'down', label: 'Down payment', value: '₱2,000.00' },
      { key: 'balance', label: 'Balance after down payment', value: '₱8,000.00' },
      { key: 'deposit', label: 'Security deposit', value: '₱3,000.00' },
    ]);
  });

  it('omits down payment, balance, and security deposit for an Airbnb booking', () => {
    expect(
      buildBookingRateRows({
        ...baseBooking,
        booking_source: 'Airbnb',
        down_payment: 0,
        balance: 10000,
        security_deposit: 0,
      })
    ).toEqual([{ key: 'rate', label: 'Booking rate', value: '₱10,000.00' }]);
  });

  it('matches Airbnb in any case and keeps pet and additional fees', () => {
    expect(
      buildBookingRateRows({
        ...baseBooking,
        booking_source: 'airbnb',
        down_payment: 0,
        security_deposit: 0,
        has_pets: true,
        pet_fee: 500,
        guest_additional_fee: 200,
      })
    ).toEqual([
      { key: 'rate', label: 'Booking rate', value: '₱10,000.00' },
      { key: 'pet', label: 'Pet fee', value: '₱500.00' },
      { key: 'additional', label: 'Additional guest fee', value: '₱200.00' },
    ]);
  });
});
