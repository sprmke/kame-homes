import { parseOccupancyDate } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { amountPerOccupiedNight } from '@/features/dashboard/bookings/components/calendar/calendarStayAmounts';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  DEFAULT_PRICING_HOLIDAY_RULES_DTO,
  findHolidayRuleDtoForDateKey,
  type PricingHolidayRuleDto,
} from '@/features/dashboard/pricing/lib/phHolidayRules';
import { isWeekendRateDay } from '@/features/dashboard/pricing/lib/pricingCalendarUtils';
import {
  DEFAULT_DOWN_PAYMENT,
  DEFAULT_GUEST_ADDITIONAL_FEE,
  DEFAULT_PARKING_GUEST_FEE,
  DEFAULT_PET_FEE,
  DEFAULT_SECURITY_DEPOSIT,
  DEFAULT_WEEKDAY_NIGHTLY_RATE,
  DEFAULT_WEEKEND_NIGHTLY_RATE,
} from '@/features/dashboard/pricing/lib/pricingDefaults';

type StayPricingFields = Pick<BookingRow, 'check_in_date' | 'check_out_date' | 'booking_rate'> & {
  /** Calendar pricing rows may omit nights until stay dates are set. */
  number_of_nights: number | null;
};

type NightlyRateOptions = {
  dateOverrides?: Record<string, number>;
  holidayRules?: PricingHolidayRuleDto[] | null;
  /** Applied Smart Pricing rates — resolves below a host override, above holiday rules. */
  smartRecommendations?: Record<string, number> | null;
};

export type PropertyPricingDefaults = {
  weekdayNightlyRate: number;
  weekendNightlyRate: number;
  downPayment: number;
  securityDeposit: number;
  petFee: number;
  parkingRateGuest: number;
  guestAdditionalFee: number;
};

export const FALLBACK_PROPERTY_PRICING_DEFAULTS: PropertyPricingDefaults = {
  weekdayNightlyRate: DEFAULT_WEEKDAY_NIGHTLY_RATE,
  weekendNightlyRate: DEFAULT_WEEKEND_NIGHTLY_RATE,
  downPayment: DEFAULT_DOWN_PAYMENT,
  securityDeposit: DEFAULT_SECURITY_DEPOSIT,
  petFee: DEFAULT_PET_FEE,
  parkingRateGuest: DEFAULT_PARKING_GUEST_FEE,
  guestAdditionalFee: DEFAULT_GUEST_ADDITIONAL_FEE,
};

export function propertyPricingDefaultsFromDto(
  dto?: Partial<PropertyPricingDefaults> | null
): PropertyPricingDefaults {
  if (!dto) return FALLBACK_PROPERTY_PRICING_DEFAULTS;
  return {
    weekdayNightlyRate:
      dto.weekdayNightlyRate ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.weekdayNightlyRate,
    weekendNightlyRate:
      dto.weekendNightlyRate ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.weekendNightlyRate,
    downPayment: dto.downPayment ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.downPayment,
    securityDeposit: dto.securityDeposit ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.securityDeposit,
    petFee: dto.petFee ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.petFee,
    parkingRateGuest: dto.parkingRateGuest ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.parkingRateGuest,
    guestAdditionalFee:
      dto.guestAdditionalFee ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.guestAdditionalFee,
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveHolidayRules(
  holidayRules?: PricingHolidayRuleDto[] | null
): PricingHolidayRuleDto[] {
  return holidayRules && holidayRules.length > 0 ? holidayRules : DEFAULT_PRICING_HOLIDAY_RULES_DTO;
}

/**
 * Nightly rate for one occupied night.
 * Precedence: host override > applied Smart Pricing > holiday premium > weekend/weekday.
 */
export function resolveNightlyRateForDate(
  date: Date,
  defaults: PropertyPricingDefaults,
  options?: {
    dateOverrides?: Record<string, number>;
    holidayRules?: PricingHolidayRuleDto[] | null;
    smartRecommendations?: Record<string, number> | null;
  }
): number {
  const key = formatDateKey(date);
  const override = options?.dateOverrides?.[key];
  if (override !== undefined) return override;

  const smart = options?.smartRecommendations?.[key];
  if (smart !== undefined) return smart;

  const base = isWeekendRateDay(date) ? defaults.weekendNightlyRate : defaults.weekdayNightlyRate;

  const rules = resolveHolidayRules(options?.holidayRules);
  const holiday = findHolidayRuleDtoForDateKey(key, rules);
  if (holiday) {
    return Math.round(base * (1 + holiday.percentage / 100));
  }

  return base;
}

export function computeDefaultBookingRate(
  booking: Pick<BookingRow, 'check_in_date' | 'check_out_date'> & {
    number_of_nights: number | null;
  },
  defaults: PropertyPricingDefaults = FALLBACK_PROPERTY_PRICING_DEFAULTS,
  dateOverrides?: Record<string, number>,
  holidayRules?: PricingHolidayRuleDto[] | null,
  smartRecommendations?: Record<string, number> | null
): number | null {
  const checkIn = parseOccupancyDate(booking.check_in_date);
  const checkOut = parseOccupancyDate(booking.check_out_date);

  if (checkIn && checkOut && checkOut > checkIn) {
    let total = 0;
    let cursor = new Date(checkIn);
    while (cursor < checkOut) {
      total += resolveNightlyRateForDate(cursor, defaults, {
        dateOverrides,
        holidayRules,
        smartRecommendations,
      });
      cursor = addDays(cursor, 1);
    }
    return total;
  }

  const nights = Number(booking.number_of_nights ?? 0);
  if (Number.isFinite(nights) && nights > 0) {
    return nights * defaults.weekdayNightlyRate;
  }

  return defaults.weekdayNightlyRate;
}

/** Saved booking rate, or property default stay total (same as Review Pricing). */
export function resolveBookingRateTotal(
  booking: StayPricingFields,
  defaults: PropertyPricingDefaults = FALLBACK_PROPERTY_PRICING_DEFAULTS,
  options?: NightlyRateOptions
): number | null {
  if (booking.booking_rate != null && booking.booking_rate !== '') {
    const amount = Number(booking.booking_rate);
    if (Number.isFinite(amount)) return amount;
  }
  return computeDefaultBookingRate(
    booking,
    defaults,
    options?.dateOverrides,
    options?.holidayRules,
    options?.smartRecommendations
  );
}

/**
 * Per-night amount for a booked calendar cell.
 * Uses saved booking_rate ÷ nights when set; otherwise that night's property rate
 * (weekday/weekend/holiday/custom) — covers PENDING_REVIEW before pricing is confirmed.
 */
export function resolveBookingNightlyForDate(
  booking: StayPricingFields,
  date: Date,
  defaults: PropertyPricingDefaults = FALLBACK_PROPERTY_PRICING_DEFAULTS,
  options?: NightlyRateOptions
): number {
  const fromSaved = amountPerOccupiedNight(
    booking.booking_rate,
    booking.number_of_nights,
    booking.check_in_date,
    booking.check_out_date
  );
  if (fromSaved != null) return fromSaved;
  return resolveNightlyRateForDate(date, defaults, options);
}

/** Average nightly for pills/tooltips when a specific night is not available. */
export function resolveBookingAverageNightly(
  booking: StayPricingFields,
  defaults: PropertyPricingDefaults = FALLBACK_PROPERTY_PRICING_DEFAULTS,
  options?: NightlyRateOptions
): number | null {
  return amountPerOccupiedNight(
    resolveBookingRateTotal(booking, defaults, options),
    booking.number_of_nights,
    booking.check_in_date,
    booking.check_out_date
  );
}
