/**
 * Parking pricing — weekday/weekend defaults (parking_settings) + date overrides.
 */

import { createServiceClient } from './orgAuth.ts';
import { ensureParkingSettings } from './parkingSettingsSeed.ts';
import {
  deleteParkingBlockedRangesCovering,
  insertParkingBlockedRange,
  loadParkingBlockedDateKeys,
} from './parkingBlockedDates.ts';
import { resolveParkingPlatformSettings } from './parkingPlatformSettings.ts';
import { ensureParkingDirectBookingToken } from './parkingDirectLink.ts';

export const DEFAULT_PARKING_WEEKDAY = 300;
export const DEFAULT_PARKING_WEEKEND = 400;

export type ParkingPricingDto = {
  weekdayNightlyRate: number;
  weekendNightlyRate: number;
  dateOverrides: Record<string, number>;
  bookedDateKeys: string[];
  blockedDateKeys: string[];
  /**
   * Live super-admin-configured guest rate cap (Phase 4) — a host rate at or above this is a
   * guaranteed-loss match, excluded from the match pool entirely. Host-readable here since
   * `platform-parking-settings` itself is super-admin-only.
   */
  guestRateCapWeekday: number;
  guestRateCapWeekend: number;
  /** Live super-admin-configured commission %, for the host-facing fee/net-payout breakdown. */
  commissionPct: number;
  /** Phase 8 — commission % applied to bookings made through this listing's direct link. */
  directCommissionPct: number;
  /** Phase 8 — opaque token + slug for building the shareable direct-booking link. */
  directBookingToken: string;
  directBookingSlug: string;
};

export type ParkingPricingPatch = {
  weekdayNightlyRate?: number;
  weekendNightlyRate?: number;
  dateOverrides?: Record<string, number>;
  blockRange?: { startDate: string; endDate: string; note?: string };
  unblockDateKeys?: string[];
};

type ParkingSettingsPricingRow = {
  weekday_nightly_rate: unknown;
  weekend_nightly_rate: unknown;
};

function pickMoney(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function validateMoneyField(value: unknown, label: string): number | null | string {
  if (value === undefined) return null;
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return `${label} must be a non-negative number`;
  }
  if (n > 999_999_999) {
    return `${label} is too large`;
  }
  return n;
}

async function loadParkingBookedDateKeys(
  parkingId: string,
  monthStart?: string,
  monthEnd?: string
): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('check_in_date, check_out_date, parking_check_in_date, parking_check_out_date, status')
    .eq('parking_id', parkingId)
    .neq('status', 'CANCELLED')
    .neq('status', 'IMPORTED');

  if (error) {
    throw new Error(`Failed to load parking booked dates: ${error.message}`);
  }

  const parseYMD = (value: string): Date | null => {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const parts = trimmed.split('-');
    if (parts.length !== 3) return null;
    const [a, b, c] = parts.map(Number);
    if (parts[0].length === 4) {
      const d = new Date(a, b - 1, c);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(c, a - 1, b);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const formatKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const rangeStart = monthStart ? parseYMD(monthStart) : null;
  const rangeEnd = monthEnd ? parseYMD(monthEnd) : null;
  const keys = new Set<string>();

  for (const row of data ?? []) {
    const checkIn = String(row.parking_check_in_date ?? row.check_in_date ?? '');
    const checkOut = String(row.parking_check_out_date ?? row.check_out_date ?? '');
    const start = parseYMD(checkIn);
    const end = parseYMD(checkOut);
    if (!start || !end || end <= start) continue;
    let cursor = new Date(start);
    const lastNight = addDays(end, -1);
    while (cursor <= lastNight) {
      if (!rangeStart || !rangeEnd || (cursor >= rangeStart && cursor <= rangeEnd)) {
        keys.add(formatKey(cursor));
      }
      cursor = addDays(cursor, 1);
    }
  }

  return [...keys].sort();
}

function nightsBetween(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];
  const keys: string[] = [];
  const cursor = new Date(start);
  const lastNight = new Date(end);
  lastNight.setDate(lastNight.getDate() - 1);
  while (cursor <= lastNight) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function validateDateKey(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/** Fri/Sat/Sun — mirrors the weekend definition used across the parking match engine. */
function isWeekendRateDay(dateKey: string): boolean {
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  return day === 0 || day === 5 || day === 6;
}

/**
 * Phase 2 decision D5 / Phase 3 fast-follow: a host rate at or above the guest rate cap is a
 * guaranteed-loss match, so it's rejected outright here — never silently clamped. Applies to
 * the base weekday/weekend rate and to per-date overrides alike.
 */
function assertWithinGuestRateCap(value: number, cap: number, label: string): void {
  if (value > cap) {
    throw new Error(
      `${label} of ₱${value} is above the platform's guest rate cap of ₱${cap} and can't be saved.`
    );
  }
}

async function loadDateOverrides(parkingId: string): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parking_pricing_date_overrides')
    .select('pricing_date, nightly_rate')
    .eq('parking_id', parkingId)
    .order('pricing_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load parking pricing overrides: ${error.message}`);
  }

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = String(row.pricing_date).slice(0, 10);
    out[key] = Number(row.nightly_rate);
  }
  return out;
}

function rowToDefaults(
  row: ParkingSettingsPricingRow | null
): Pick<ParkingPricingDto, 'weekdayNightlyRate' | 'weekendNightlyRate'> {
  return {
    weekdayNightlyRate: pickMoney(row?.weekday_nightly_rate, DEFAULT_PARKING_WEEKDAY),
    weekendNightlyRate: pickMoney(row?.weekend_nightly_rate, DEFAULT_PARKING_WEEKEND),
  };
}

export async function loadParkingPricing(
  parkingId: string,
  options?: { monthStart?: string; monthEnd?: string }
): Promise<ParkingPricingDto> {
  await ensureParkingSettings(parkingId);
  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from('parking_settings')
    .select('weekday_nightly_rate, weekend_nightly_rate')
    .eq('parking_id', parkingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load parking pricing: ${error.message}`);
  }

  const [dateOverrides, bookedDateKeys, blockedDateKeys, platformSettings, directLink] =
    await Promise.all([
      loadDateOverrides(parkingId),
      loadParkingBookedDateKeys(parkingId, options?.monthStart, options?.monthEnd),
      loadParkingBlockedDateKeys(parkingId, options?.monthStart, options?.monthEnd),
      resolveParkingPlatformSettings(),
      ensureParkingDirectBookingToken(parkingId),
    ]);

  return {
    ...rowToDefaults(row as ParkingSettingsPricingRow | null),
    dateOverrides,
    bookedDateKeys,
    blockedDateKeys,
    guestRateCapWeekday: platformSettings.guestRateWeekday,
    guestRateCapWeekend: platformSettings.guestRateWeekend,
    commissionPct: platformSettings.commissionPct,
    directCommissionPct: platformSettings.directCommissionPct,
    directBookingToken: directLink.token,
    directBookingSlug: directLink.slug,
  };
}

export async function saveParkingPricing(
  parkingId: string,
  patch: ParkingPricingPatch,
  opts?: { userId?: string | null }
): Promise<ParkingPricingDto> {
  await ensureParkingSettings(parkingId);
  const supabase = createServiceClient();
  const platformSettings = await resolveParkingPlatformSettings();

  const settingsPatch: Record<string, unknown> = {};
  const fields: Array<[keyof ParkingPricingPatch, string, string, number]> = [
    [
      'weekdayNightlyRate',
      'weekday_nightly_rate',
      'Weekday rate',
      platformSettings.guestRateWeekday,
    ],
    [
      'weekendNightlyRate',
      'weekend_nightly_rate',
      'Weekend rate',
      platformSettings.guestRateWeekend,
    ],
  ];

  for (const [patchKey, dbKey, label, cap] of fields) {
    if (patch[patchKey] === undefined) continue;
    const validated = validateMoneyField(patch[patchKey], label);
    if (typeof validated === 'string') throw new Error(validated);
    if (validated !== null) {
      assertWithinGuestRateCap(validated, cap, label);
      settingsPatch[dbKey] = validated;
    }
  }

  if (Object.keys(settingsPatch).length > 0) {
    settingsPatch.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from('parking_settings')
      .update(settingsPatch)
      .eq('parking_id', parkingId);

    if (error) {
      throw new Error(`Failed to save parking pricing defaults: ${error.message}`);
    }
  }

  if (patch.dateOverrides !== undefined) {
    const { error: deleteError } = await supabase
      .from('parking_pricing_date_overrides')
      .delete()
      .eq('parking_id', parkingId);

    if (deleteError) {
      throw new Error(`Failed to clear parking pricing overrides: ${deleteError.message}`);
    }

    const rows = Object.entries(patch.dateOverrides).map(([date, rate]) => {
      if (!validateDateKey(date)) {
        throw new Error(`Invalid override date: ${date}`);
      }
      const validated = validateMoneyField(rate, 'Override rate');
      if (typeof validated === 'string') throw new Error(validated);
      if (validated === null) throw new Error('Override rate is required');
      const cap = isWeekendRateDay(date)
        ? platformSettings.guestRateWeekend
        : platformSettings.guestRateWeekday;
      assertWithinGuestRateCap(validated, cap, `Override rate for ${date}`);
      return {
        parking_id: parkingId,
        pricing_date: date,
        nightly_rate: validated,
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('parking_pricing_date_overrides')
        .insert(rows);

      if (insertError) {
        throw new Error(`Failed to save parking pricing overrides: ${insertError.message}`);
      }
    }
  }

  if (patch.blockRange) {
    const { startDate, endDate } = patch.blockRange;
    const nights = nightsBetween(startDate, endDate);
    if (nights.length === 0) {
      throw new Error('blockRange endDate must be after startDate');
    }
    const bookedKeys = new Set(await loadParkingBookedDateKeys(parkingId, startDate, endDate));
    if (nights.some((key) => bookedKeys.has(key))) {
      throw new Error('Cannot block dates that are already booked');
    }
    await insertParkingBlockedRange(
      parkingId,
      startDate,
      endDate,
      patch.blockRange.note,
      opts?.userId
    );
  }

  if (patch.unblockDateKeys && patch.unblockDateKeys.length > 0) {
    await deleteParkingBlockedRangesCovering(parkingId, patch.unblockDateKeys);
  }

  return loadParkingPricing(parkingId);
}
