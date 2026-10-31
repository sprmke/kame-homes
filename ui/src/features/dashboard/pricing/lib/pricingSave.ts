import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  startOfMonth,
  startOfToday,
} from 'date-fns';

import type { PricingHolidayRuleDto } from '@/features/dashboard/pricing/lib/phHolidayRules';
import {
  resolveNightlyRateForDate,
  type PropertyPricingDefaults,
} from '@/features/dashboard/pricing/lib/pricingCompute';
import type {
  PropertyFeeConfig,
  PropertyFeeId,
} from '@/features/dashboard/pricing/lib/pricingDefaults';
import { feesFromPricingDefaults } from '@/features/dashboard/pricing/lib/pricingDefaults';
import type { PropertyPricingPatch } from '@/features/dashboard/pricing/lib/propertyPricingApi';

export type PricingBaseRateScope = 'all_future' | 'current_month';

export type PricingSaveOptions = {
  overrideCustomRates: boolean;
  baseRateScope: PricingBaseRateScope;
};

export function dateOverridesRecordFromMap(map: Map<string, number>): Record<string, number> {
  const record: Record<string, number> = {};
  map.forEach((rate, date) => {
    record[date] = rate;
  });
  return record;
}

export function buildFeesOnlySavePatch(fees: PropertyFeeConfig[]): PropertyPricingPatch {
  const feeById = Object.fromEntries(fees.map((fee) => [fee.id, fee.amount])) as Record<
    PropertyFeeId,
    number
  >;

  return {
    downPayment: feeById.down_payment,
    securityDeposit: feeById.security_deposit,
    petFee: feeById.pet_fee,
    parkingRateGuest: feeById.parking_rate_guest,
    guestAdditionalFee: feeById.guest_additional_fee,
  };
}

export type PricingFormBaseline = {
  weekdayRate: number;
  weekendRate: number;
  feeAmounts: Record<PropertyFeeId, number>;
};

export function pricingBaselineFromDefaults(
  defaults: PropertyPricingDefaults
): PricingFormBaseline {
  const feeConfigs = feesFromPricingDefaults(defaults);
  return {
    weekdayRate: defaults.weekdayNightlyRate,
    weekendRate: defaults.weekendNightlyRate,
    feeAmounts: Object.fromEntries(feeConfigs.map((fee) => [fee.id, fee.amount])) as Record<
      PropertyFeeId,
      number
    >,
  };
}

export function pricingFormHasBaseRateChanges(
  baseline: PricingFormBaseline,
  weekdayRate: number,
  weekendRate: number
): boolean {
  return weekdayRate !== baseline.weekdayRate || weekendRate !== baseline.weekendRate;
}

export function pricingFormHasFeeChanges(
  baseline: PricingFormBaseline,
  fees: PropertyFeeConfig[]
): boolean {
  return fees.some((fee) => baseline.feeAmounts[fee.id] !== fee.amount);
}

export function buildPricingSavePatch(
  input: {
    weekdayRate: number;
    weekendRate: number;
    fees: PropertyFeeConfig[];
    customDatePrices: Map<string, number>;
    currentMonth: Date;
    holidayRuleDtos?: PricingHolidayRuleDto[] | null;
    bookedDateKeys: Set<string>;
  },
  options: PricingSaveOptions
): PropertyPricingPatch {
  const feeById = Object.fromEntries(input.fees.map((fee) => [fee.id, fee.amount])) as Record<
    PropertyFeeId,
    number
  >;

  const formDefaults: PropertyPricingDefaults = {
    weekdayNightlyRate: input.weekdayRate,
    weekendNightlyRate: input.weekendRate,
    downPayment: feeById.down_payment,
    securityDeposit: feeById.security_deposit,
    petFee: feeById.pet_fee,
    parkingRateGuest: feeById.parking_rate_guest,
    guestAdditionalFee: feeById.guest_additional_fee,
  };

  const dateOverrides: Record<string, number> = {};
  if (!options.overrideCustomRates) {
    input.customDatePrices.forEach((rate, date) => {
      dateOverrides[date] = rate;
    });
  }

  if (options.baseRateScope === 'current_month') {
    const monthStart = startOfMonth(input.currentMonth);
    const monthEnd = endOfMonth(input.currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    for (const day of days) {
      if (isBefore(day, startOfToday())) continue;
      const key = format(day, 'yyyy-MM-dd');
      if (input.bookedDateKeys.has(key)) continue;
      if (!options.overrideCustomRates && input.customDatePrices.has(key)) {
        continue;
      }
      dateOverrides[key] = resolveNightlyRateForDate(day, formDefaults, {
        holidayRules: input.holidayRuleDtos,
      });
    }
  }

  const patch: PropertyPricingPatch = {
    downPayment: feeById.down_payment,
    securityDeposit: feeById.security_deposit,
    petFee: feeById.pet_fee,
    parkingRateGuest: feeById.parking_rate_guest,
    guestAdditionalFee: feeById.guest_additional_fee,
    dateOverrides,
  };

  if (options.baseRateScope === 'all_future') {
    patch.weekdayNightlyRate = input.weekdayRate;
    patch.weekendNightlyRate = input.weekendRate;
  }

  return patch;
}
