import { isAirbnbBookingSource } from '@/features/dashboard/bookings/lib/totalGuestBalance';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { formatMoney } from '@/utils/format/currency';

export type BookingRateRow = {
  key: string;
  label: string;
  value: string;
};

type BookingRateRowSource = Pick<
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

/**
 * Rates & fees ledger for the booking detail Pricing tab.
 *
 * Airbnb stays are paid through the platform, so down payment, balance after
 * down payment, and security deposit rows are omitted rather than shown as ₱0.00.
 */
export function buildBookingRateRows(booking: BookingRateRowSource): BookingRateRow[] {
  const additionalGuestFee = Number(booking.guest_additional_fee ?? 0);
  const petFee = booking.has_pets === true ? formatMoney(booking.pet_fee) : '-';

  const rows: BookingRateRow[] = isAirbnbBookingSource(booking.booking_source)
    ? [
        { key: 'rate', label: 'Booking rate', value: formatMoney(booking.booking_rate) },
        { key: 'pet', label: 'Pet fee', value: petFee },
        {
          key: 'additional',
          label: 'Additional guest fee',
          value: additionalGuestFee > 0 ? formatMoney(additionalGuestFee) : '-',
        },
      ]
    : [
        { key: 'rate', label: 'Booking rate', value: formatMoney(booking.booking_rate) },
        { key: 'down', label: 'Down payment', value: formatMoney(booking.down_payment) },
        {
          key: 'balance',
          label: 'Balance after down payment',
          value: formatMoney(booking.balance),
        },
        {
          key: 'deposit',
          label: 'Security deposit',
          value: formatMoney(booking.security_deposit),
        },
        { key: 'pet', label: 'Pet fee', value: petFee },
        {
          key: 'additional',
          label: 'Additional guest fee',
          value: additionalGuestFee > 0 ? formatMoney(additionalGuestFee) : '-',
        },
      ];

  return rows.filter((row) => row.value !== '-');
}
