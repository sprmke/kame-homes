import type { GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';
import { countParkingNights } from '@/features/guest/pay-parking/lib/payParkingHelpers';

import { toGuestSubmissionDate } from '@/utils/format/dates';

/** Server fallback when a property has no `default_down_payment` (`_shared/propertyPricing.ts`). */
export const DEFAULT_GUEST_DOWN_PAYMENT = 1500;

export type GuestFormPaymentBreakdown = {
  stayNights: number;
  downPayment: number;
  total: number;
};

/**
 * The downpayment is the property's flat Default down payment (host Pricing settings), the same
 * value the host review pricing form starts from — not a per-night amount.
 *
 * Phase 7: parking is a pure interest signal on the guest form, priced and paid for
 * separately through the marketplace once the booking is confirmed — no parking line item
 * in the downpayment total here anymore.
 */
export function computeGuestFormPaymentBreakdown(
  values: Pick<GuestFormData, 'checkInDate' | 'checkOutDate'>,
  propertyDownPayment: number | null | undefined
): GuestFormPaymentBreakdown {
  const stayNights = countParkingNights(
    toGuestSubmissionDate(values.checkInDate),
    toGuestSubmissionDate(values.checkOutDate)
  );
  const downPayment =
    typeof propertyDownPayment === 'number' &&
    Number.isFinite(propertyDownPayment) &&
    propertyDownPayment >= 0
      ? propertyDownPayment
      : DEFAULT_GUEST_DOWN_PAYMENT;

  return {
    stayNights,
    downPayment,
    total: downPayment,
  };
}
