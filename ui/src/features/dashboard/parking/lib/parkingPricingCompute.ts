import type { ParkingPricingDefaults } from '@/features/dashboard/parking/lib/parkingPricingDefaults';
import { dateKey, isWeekendRateDay } from '@/features/dashboard/pricing/lib/pricingCalendarUtils';

export function resolveParkingNightlyRateForDate(
  date: Date,
  defaults: ParkingPricingDefaults,
  dateOverrides: Record<string, number> = {}
): number {
  const key = dateKey(date);
  const override = dateOverrides[key];
  if (override !== undefined) return override;
  return isWeekendRateDay(date) ? defaults.weekendNightlyRate : defaults.weekdayNightlyRate;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Sum nightly rates for occupied nights [checkIn, checkOut) using admin parking pricing rules. */
export function computeParkingStayTotal(
  checkIn: Date,
  checkOut: Date,
  defaults: ParkingPricingDefaults,
  dateOverrides: Record<string, number> = {}
): number {
  let total = 0;
  let cursor = toMidnight(checkIn);
  const end = toMidnight(checkOut);
  while (cursor < end) {
    total += resolveParkingNightlyRateForDate(cursor, defaults, dateOverrides);
    cursor = addDays(cursor, 1);
  }
  return total;
}

export { dateKey };
