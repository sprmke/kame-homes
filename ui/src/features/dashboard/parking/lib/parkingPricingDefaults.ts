export const DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE = 300;
export const DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE = 400;

/**
 * Fallback-only defaults (Phase 4) — used only before the real `parking-pricing` GET response
 * loads (which now carries the live `guestRateCapWeekday`/`guestRateCapWeekend` cap, sourced
 * from the super-admin-configurable `platform_parking_settings`). Do not use these for cap
 * enforcement once real data has loaded; see `ParkingPricingRatesFormCard.tsx`.
 */
export const STUB_GUEST_PARKING_RATE_WEEKDAY = 400;
export const STUB_GUEST_PARKING_RATE_WEEKEND = 400;
export const STUB_COMMISSION_PCT = 0.1;
/** Phase 8 fallback — half the standard stub, matches the platform_parking_settings default. */
export const STUB_DIRECT_COMMISSION_PCT = 0.05;

export type ParkingPricingDefaults = {
  weekdayNightlyRate: number;
  weekendNightlyRate: number;
};

export const FALLBACK_PARKING_PRICING_DEFAULTS: ParkingPricingDefaults = {
  weekdayNightlyRate: DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE,
  weekendNightlyRate: DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE,
};

export function parkingPricingDefaultsFromDto(
  dto?: Partial<ParkingPricingDefaults> | null
): ParkingPricingDefaults {
  if (!dto) return FALLBACK_PARKING_PRICING_DEFAULTS;
  return {
    weekdayNightlyRate:
      dto.weekdayNightlyRate ?? FALLBACK_PARKING_PRICING_DEFAULTS.weekdayNightlyRate,
    weekendNightlyRate:
      dto.weekendNightlyRate ?? FALLBACK_PARKING_PRICING_DEFAULTS.weekendNightlyRate,
  };
}
