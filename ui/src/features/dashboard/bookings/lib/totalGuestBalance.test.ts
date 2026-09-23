import { describe, expect, it } from 'vitest';

import type { BookingFinanceInput } from '@/features/dashboard/bookings/lib/bookingFinance';
import {
  computeTotalGuestBalance,
  guestBalancePaidRecorded,
  guestBalancePaymentReceiptRequired,
} from '@/features/dashboard/bookings/lib/totalGuestBalance';

const baseFinance = {
  status: 'PENDING_REVIEW',
  booking_source: 'Facebook',
  has_pets: false,
  need_parking: false,
} as BookingFinanceInput;

describe('totalGuestBalance', () => {
  it('returns null when booking rate missing', () => {
    expect(computeTotalGuestBalance({ ...baseFinance, booking_rate: null })).toBeNull();
  });

  it('computes direct booking total with fees', () => {
    expect(
      computeTotalGuestBalance({
        ...baseFinance,
        booking_rate: 10000,
        down_payment: 2000,
        security_deposit: 3000,
        has_pets: true,
        pet_fee: 500,
        guest_additional_fee: 200,
      })
    ).toBe(11700);
  });

  it('Airbnb excludes rate, DP, and SD', () => {
    expect(
      computeTotalGuestBalance({
        ...baseFinance,
        booking_rate: 10000,
        down_payment: 2000,
        security_deposit: 3000,
        guest_additional_fee: 200,
        booking_source: 'Airbnb',
      })
    ).toBe(200);
  });

  it('receipt required when total due is non-zero', () => {
    expect(guestBalancePaymentReceiptRequired(0)).toBe(false);
    expect(guestBalancePaymentReceiptRequired(100)).toBe(true);
  });

  it('guestBalancePaidRecorded clamps invalid values', () => {
    expect(guestBalancePaidRecorded({ ...baseFinance, guest_balance_paid_amount: '-5' })).toBe(0);
    expect(guestBalancePaidRecorded({ ...baseFinance, guest_balance_paid_amount: '150.555' })).toBe(
      150.56
    );
  });
});
