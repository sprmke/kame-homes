/**
 * Property pricing defaults — aligned with ReviewPricingForm / booking workflow.
 * @see ui/src/features/dashboard/bookings/components/ReviewPricingForm.tsx
 */

import type { PropertyPricingDefaults } from '@/features/dashboard/pricing/lib/pricingCompute';
import type { PropertyPricingPatch } from '@/features/dashboard/pricing/lib/propertyPricingApi';

export const DEFAULT_WEEKDAY_NIGHTLY_RATE = 2799;
export const DEFAULT_WEEKEND_NIGHTLY_RATE = 2999;
export const DEFAULT_DOWN_PAYMENT = 1500;
export const DEFAULT_SECURITY_DEPOSIT = 1500;
export const DEFAULT_PET_FEE = 300;
export const DEFAULT_PARKING_GUEST_FEE = 400;
export const DEFAULT_GUEST_ADDITIONAL_FEE = 0;

export type PropertyFeeId =
  'down_payment' | 'security_deposit' | 'pet_fee' | 'parking_rate_guest' | 'guest_additional_fee';

export type PropertyFeeConfig = {
  id: PropertyFeeId;
  /** Maps to guest_submissions column */
  column: PropertyFeeId;
  label: string;
  amount: number;
  /** Flat per booking — matches workflow pricing fields */
  type: 'flat';
};

export const INITIAL_PROPERTY_FEES: PropertyFeeConfig[] = [
  {
    id: 'down_payment',
    column: 'down_payment',
    label: 'Down payment',
    amount: DEFAULT_DOWN_PAYMENT,
    type: 'flat',
  },
  {
    id: 'security_deposit',
    column: 'security_deposit',
    label: 'Security deposit',
    amount: DEFAULT_SECURITY_DEPOSIT,
    type: 'flat',
  },
  {
    id: 'pet_fee',
    column: 'pet_fee',
    label: 'Pet fee',
    amount: DEFAULT_PET_FEE,
    type: 'flat',
  },
  {
    id: 'parking_rate_guest',
    column: 'parking_rate_guest',
    label: 'Parking rate',
    amount: DEFAULT_PARKING_GUEST_FEE,
    type: 'flat',
  },
  {
    id: 'guest_additional_fee',
    column: 'guest_additional_fee',
    label: 'Extra guest fee',
    amount: DEFAULT_GUEST_ADDITIONAL_FEE,
    type: 'flat',
  },
];

export function feesFromPricingDefaults(defaults: PropertyPricingDefaults): PropertyFeeConfig[] {
  const amounts: Record<PropertyFeeId, number> = {
    down_payment: defaults.downPayment,
    security_deposit: defaults.securityDeposit,
    pet_fee: defaults.petFee,
    parking_rate_guest: defaults.parkingRateGuest,
    guest_additional_fee: defaults.guestAdditionalFee,
  };
  return INITIAL_PROPERTY_FEES.map((fee) => ({
    ...fee,
    amount: amounts[fee.id],
  }));
}

export function pricingPatchFromUiState(
  weekdayRate: number,
  weekendRate: number,
  fees: PropertyFeeConfig[],
  customDatePrices: Map<string, number>
): PropertyPricingPatch {
  const feeById = Object.fromEntries(fees.map((fee) => [fee.id, fee.amount])) as Record<
    PropertyFeeId,
    number
  >;
  const dateOverrides: Record<string, number> = {};
  customDatePrices.forEach((rate, date) => {
    dateOverrides[date] = rate;
  });
  return {
    weekdayNightlyRate: weekdayRate,
    weekendNightlyRate: weekendRate,
    downPayment: feeById.down_payment,
    securityDeposit: feeById.security_deposit,
    petFee: feeById.pet_fee,
    parkingRateGuest: feeById.parking_rate_guest,
    guestAdditionalFee: feeById.guest_additional_fee,
    dateOverrides,
  };
}
