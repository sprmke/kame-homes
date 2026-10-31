import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  startOfMonth,
  startOfToday,
} from 'date-fns';

import type {
  ParkingPricingDto,
  ParkingPricingPatch,
} from '@/features/dashboard/parking/lib/parkingPricingApi';
import { resolveParkingNightlyRateForDate } from '@/features/dashboard/parking/lib/parkingPricingCompute';
import type { ParkingPricingDefaults } from '@/features/dashboard/parking/lib/parkingPricingDefaults';
import { parkingPricingDefaultsFromDto } from '@/features/dashboard/parking/lib/parkingPricingDefaults';

export type ParkingPricingBaseRateScope = 'all_future' | 'current_month';

export type ParkingPricingSaveOptions = {
  overrideCustomRates: boolean;
  baseRateScope: ParkingPricingBaseRateScope;
};

export function dateOverridesRecordFromMap(map: Map<string, number>): Record<string, number> {
  const record: Record<string, number> = {};
  map.forEach((rate, date) => {
    record[date] = rate;
  });
  return record;
}

export type ParkingPricingFormBaseline = {
  weekdayRate: number;
  weekendRate: number;
};

export function parkingPricingBaselineFromDto(dto: ParkingPricingDto): ParkingPricingFormBaseline {
  const defaults = parkingPricingDefaultsFromDto(dto);
  return {
    weekdayRate: defaults.weekdayNightlyRate,
    weekendRate: defaults.weekendNightlyRate,
  };
}

export function parkingPricingFormHasBaseRateChanges(
  baseline: ParkingPricingFormBaseline,
  weekdayRate: number,
  weekendRate: number
): boolean {
  return weekdayRate !== baseline.weekdayRate || weekendRate !== baseline.weekendRate;
}

export function buildParkingPricingSavePatch(
  input: {
    weekdayRate: number;
    weekendRate: number;
    customDatePrices: Map<string, number>;
    currentMonth: Date;
    bookedDateKeys: Set<string>;
  },
  options: ParkingPricingSaveOptions
): ParkingPricingPatch {
  const formDefaults: ParkingPricingDefaults = {
    weekdayNightlyRate: input.weekdayRate,
    weekendNightlyRate: input.weekendRate,
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
      dateOverrides[key] = resolveParkingNightlyRateForDate(day, formDefaults);
    }
  }

  const patch: ParkingPricingPatch = { dateOverrides };

  if (options.baseRateScope === 'all_future') {
    patch.weekdayNightlyRate = input.weekdayRate;
    patch.weekendNightlyRate = input.weekendRate;
  }

  return patch;
}
