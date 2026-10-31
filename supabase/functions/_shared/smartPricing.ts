/**
 * Smart Pricing — settings load/save + first-party history feature extraction.
 *
 * The engine itself (smartPricingEngine.ts) is pure; this module is the DB seam:
 *  - loadSmartPricingSettings / saveSmartPricingSettings  → property_smart_pricing_settings
 *  - gatherHistoryFeatures  → SmartHistoryFeatures from guest_submissions + forward calendar
 *
 * Gated on the `smartPricing` plan feature by the calling edge functions, not here.
 */

import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { createServiceClient } from './orgAuth.ts';
import { loadBlockedDateKeys } from './propertyBlockedDates.ts';
import { loadBookedDateKeys } from './propertyPricing.ts';
import {
  defaultLeadTimeConfig,
  type SmartAggressiveness,
  type SmartHistoryFeatures,
  type SmartLeadTimeConfig,
  type SmartRounding,
  type SmartSeasonRule,
} from './smartPricingEngine.ts';

export type SmartPricingMode = 'review_only' | 'autopilot';
export type SmartPricingBaseSource = 'property_rates' | 'custom';

export type SmartPricingSettings = {
  enabled: boolean;
  mode: SmartPricingMode;
  baseSource: SmartPricingBaseSource;
  baseWeekday: number | null;
  baseWeekend: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  aggressiveness: SmartAggressiveness;
  dowAdjust: Record<string, number>;
  seasonRules: SmartSeasonRule[];
  leadTime: SmartLeadTimeConfig;
  orphanGapDiscountPct: number;
  occupancyTiltEnabled: boolean;
  losDiscounts: { weeklyPct: number; monthlyPct: number };
  rounding: SmartRounding;
  windowDays: number;
  aiRationaleEnabled: boolean;
  lastRunAt: string | null;
};

export const DEFAULT_SMART_PRICING_SETTINGS: SmartPricingSettings = {
  enabled: false,
  mode: 'review_only',
  baseSource: 'property_rates',
  baseWeekday: null,
  baseWeekend: null,
  minPrice: null,
  maxPrice: null,
  aggressiveness: 'balanced',
  dowAdjust: {},
  seasonRules: [],
  leadTime: defaultLeadTimeConfig(),
  orphanGapDiscountPct: 12,
  // Off by default: forward-occupancy pace needs a per-listing historical baseline we rarely
  // have, and a naive "few bookings ahead = cut prices" reading punishes normal small listings.
  occupancyTiltEnabled: false,
  losDiscounts: { weeklyPct: 0, monthlyPct: 0 },
  rounding: 'r50',
  windowDays: 365,
  aiRationaleEnabled: false,
  lastRunAt: null,
};

const MODES: SmartPricingMode[] = ['review_only', 'autopilot'];
const BASE_SOURCES: SmartPricingBaseSource[] = ['property_rates', 'custom'];
const AGGRESSIVENESS: SmartAggressiveness[] = ['conservative', 'balanced', 'aggressive'];
const ROUNDING: SmartRounding[] = ['r50', 'r99', 'r100', 'none'];

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegOrNull(value: unknown, label: string): number | null {
  const n = num(value);
  if (n == null) return null;
  if (n < 0) throw new Error(`${label} must be a non-negative number`);
  if (n > 9_999_999) throw new Error(`${label} is too large`);
  return n;
}

function parseSeasonRules(raw: unknown): SmartSeasonRule[] {
  if (!Array.isArray(raw)) return [];
  const out: SmartSeasonRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    const name = String(row.name ?? '').trim();
    const startDate = String(row.startDate ?? '').trim();
    const endDate = String(row.endDate ?? '').trim();
    const percentage = Number(row.percentage);
    if (!id || !name) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) continue;
    if (startDate > endDate) continue;
    if (!Number.isFinite(percentage) || percentage < -90 || percentage > 500) continue;
    out.push({ id, name, startDate, endDate, percentage });
  }
  return out;
}

function parseLeadTime(raw: unknown): SmartLeadTimeConfig {
  const fallback = defaultLeadTimeConfig();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const tiers = (value: unknown): { days: number; pct: number }[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((t) => {
        const row = (t ?? {}) as Record<string, unknown>;
        const days = Number(row.days);
        const pct = Number(row.pct);
        if (!Number.isFinite(days) || days < 0 || days > 730) return null;
        if (!Number.isFinite(pct) || pct < -90 || pct > 200) return null;
        return { days, pct };
      })
      .filter((t): t is { days: number; pct: number } => t !== null);
  };
  const lastMinute = tiers(obj.lastMinute);
  const farOut = tiers(obj.farOut);
  return {
    lastMinute: lastMinute.length > 0 ? lastMinute : fallback.lastMinute,
    farOut: farOut.length > 0 ? farOut : fallback.farOut,
  };
}

function parseDowAdjust(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(key)) continue;
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < -80 || pct > 200) continue;
    out[key] = pct;
  }
  return out;
}

type SettingsRow = Record<string, unknown>;

function rowToSettings(row: SettingsRow | null): SmartPricingSettings {
  if (!row) return { ...DEFAULT_SMART_PRICING_SETTINGS };
  const losRaw = (row.los_discounts ?? {}) as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    mode: MODES.includes(row.mode as SmartPricingMode)
      ? (row.mode as SmartPricingMode)
      : 'review_only',
    baseSource: BASE_SOURCES.includes(row.base_source as SmartPricingBaseSource)
      ? (row.base_source as SmartPricingBaseSource)
      : 'property_rates',
    baseWeekday: num(row.base_weekday),
    baseWeekend: num(row.base_weekend),
    minPrice: num(row.min_price),
    maxPrice: num(row.max_price),
    aggressiveness: AGGRESSIVENESS.includes(row.aggressiveness as SmartAggressiveness)
      ? (row.aggressiveness as SmartAggressiveness)
      : 'balanced',
    dowAdjust: parseDowAdjust(row.dow_adjust),
    seasonRules: parseSeasonRules(row.season_rules),
    leadTime: parseLeadTime(row.lead_time),
    orphanGapDiscountPct: num(row.orphan_gap_discount_pct) ?? 15,
    occupancyTiltEnabled: row.occupancy_tilt_enabled !== false,
    losDiscounts: {
      weeklyPct: Number(losRaw.weeklyPct) || 0,
      monthlyPct: Number(losRaw.monthlyPct) || 0,
    },
    rounding: ROUNDING.includes(row.rounding as SmartRounding)
      ? (row.rounding as SmartRounding)
      : 'r50',
    windowDays: num(row.window_days) ?? 365,
    aiRationaleEnabled: row.ai_rationale_enabled === true,
    lastRunAt: (row.last_run_at as string | null) ?? null,
  };
}

export async function loadSmartPricingSettings(propertyId: string): Promise<SmartPricingSettings> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_smart_pricing_settings')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Smart Pricing settings: ${error.message}`);
  return rowToSettings(data as SettingsRow | null);
}

export type SmartPricingSettingsPatch = Partial<{
  enabled: boolean;
  mode: SmartPricingMode;
  baseSource: SmartPricingBaseSource;
  baseWeekday: number | null;
  baseWeekend: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  aggressiveness: SmartAggressiveness;
  dowAdjust: Record<string, number>;
  seasonRules: SmartSeasonRule[];
  leadTime: SmartLeadTimeConfig;
  orphanGapDiscountPct: number;
  occupancyTiltEnabled: boolean;
  losDiscounts: { weeklyPct: number; monthlyPct: number };
  rounding: SmartRounding;
  windowDays: number;
  aiRationaleEnabled: boolean;
}>;

export async function saveSmartPricingSettings(
  propertyId: string,
  patch: SmartPricingSettingsPatch,
  options?: { userId?: string | null }
): Promise<SmartPricingSettings> {
  const supabase = createServiceClient();
  const current = await loadSmartPricingSettings(propertyId);

  const next: SmartPricingSettings = { ...current };
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (patch.mode !== undefined) {
    if (!MODES.includes(patch.mode)) throw new Error('Invalid mode');
    next.mode = patch.mode;
  }
  if (patch.baseSource !== undefined) {
    if (!BASE_SOURCES.includes(patch.baseSource)) throw new Error('Invalid base source');
    next.baseSource = patch.baseSource;
  }
  if (patch.baseWeekday !== undefined)
    next.baseWeekday = nonNegOrNull(patch.baseWeekday, 'Base weekday rate');
  if (patch.baseWeekend !== undefined)
    next.baseWeekend = nonNegOrNull(patch.baseWeekend, 'Base weekend rate');
  if (patch.minPrice !== undefined) next.minPrice = nonNegOrNull(patch.minPrice, 'Minimum price');
  if (patch.maxPrice !== undefined) next.maxPrice = nonNegOrNull(patch.maxPrice, 'Maximum price');
  // A zero ceiling would clamp every recommended rate to 0 — reject it outright.
  if (next.maxPrice != null && next.maxPrice <= 0) {
    throw new Error('Maximum price must be greater than 0 (or leave it blank for no limit)');
  }
  if (next.minPrice != null && next.maxPrice != null && next.maxPrice < next.minPrice) {
    throw new Error('Maximum price must be greater than or equal to the minimum price');
  }
  if (patch.aggressiveness !== undefined) {
    if (!AGGRESSIVENESS.includes(patch.aggressiveness)) throw new Error('Invalid aggressiveness');
    next.aggressiveness = patch.aggressiveness;
  }
  if (patch.dowAdjust !== undefined) next.dowAdjust = parseDowAdjust(patch.dowAdjust);
  if (patch.seasonRules !== undefined) next.seasonRules = parseSeasonRules(patch.seasonRules);
  if (patch.leadTime !== undefined) next.leadTime = parseLeadTime(patch.leadTime);
  if (patch.orphanGapDiscountPct !== undefined) {
    const n = Number(patch.orphanGapDiscountPct);
    if (!Number.isFinite(n) || n < 0 || n > 90)
      throw new Error('Orphan-gap discount must be 0–90%');
    next.orphanGapDiscountPct = n;
  }
  if (patch.occupancyTiltEnabled !== undefined) {
    next.occupancyTiltEnabled = Boolean(patch.occupancyTiltEnabled);
  }
  if (patch.losDiscounts !== undefined) {
    const weeklyPct = Number(patch.losDiscounts.weeklyPct);
    const monthlyPct = Number(patch.losDiscounts.monthlyPct);
    next.losDiscounts = {
      weeklyPct: Number.isFinite(weeklyPct) ? Math.max(0, Math.min(60, weeklyPct)) : 0,
      monthlyPct: Number.isFinite(monthlyPct) ? Math.max(0, Math.min(70, monthlyPct)) : 0,
    };
  }
  if (patch.rounding !== undefined) {
    if (!ROUNDING.includes(patch.rounding)) throw new Error('Invalid rounding');
    next.rounding = patch.rounding;
  }
  if (patch.windowDays !== undefined) {
    const n = Number(patch.windowDays);
    if (!Number.isFinite(n) || n < 30 || n > 730) throw new Error('Window must be 30–730 days');
    next.windowDays = Math.round(n);
  }
  if (patch.aiRationaleEnabled !== undefined) {
    next.aiRationaleEnabled = Boolean(patch.aiRationaleEnabled);
  }

  const { error } = await supabase.from('property_smart_pricing_settings').upsert(
    {
      property_id: propertyId,
      enabled: next.enabled,
      mode: next.mode,
      base_source: next.baseSource,
      base_weekday: next.baseWeekday,
      base_weekend: next.baseWeekend,
      min_price: next.minPrice,
      max_price: next.maxPrice,
      aggressiveness: next.aggressiveness,
      dow_adjust: next.dowAdjust,
      season_rules: next.seasonRules,
      lead_time: next.leadTime,
      orphan_gap_discount_pct: next.orphanGapDiscountPct,
      occupancy_tilt_enabled: next.occupancyTiltEnabled,
      los_discounts: next.losDiscounts,
      rounding: next.rounding,
      window_days: next.windowDays,
      ai_rationale_enabled: next.aiRationaleEnabled,
      updated_by: options?.userId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'property_id' }
  );
  if (error) throw new Error(`Failed to save Smart Pricing settings: ${error.message}`);

  return loadSmartPricingSettings(propertyId);
}

// --- history feature extraction --------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function parseStayDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();
  const mdy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  return null;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

const NEUTRAL_DOW = [1, 1, 1, 1, 1, 1, 1];
const NEUTRAL_MONTH = Array.from({ length: 12 }, () => 1);
/** Fallback weekend lift when there is not enough history to learn one — weekdays untouched. */
const COLD_START_DOW = [1.05, 1.0, 1.0, 1.0, 1.0, 1.05, 1.06]; // Sun..Sat

/** Booking volume at/above which the learned demand curves are fully trusted. */
const DEMAND_CONFIDENCE_FLOOR_NIGHTS = 12;
const DEMAND_CONFIDENCE_FULL_NIGHTS = 140;

function demandConfidenceFor(totalNights: number): number {
  const span = DEMAND_CONFIDENCE_FULL_NIGHTS - DEMAND_CONFIDENCE_FLOOR_NIGHTS;
  return clamp((totalNights - DEMAND_CONFIDENCE_FLOOR_NIGHTS) / span, 0, 1);
}

async function forwardOccupancy(
  propertyId: string,
  today: string
): Promise<SmartHistoryFeatures['forwardOccupancy']> {
  const end = new Date(new Date(`${today}T00:00:00Z`).getTime() + 90 * MS_PER_DAY);
  const endYmd = end.toISOString().slice(0, 10);
  const [booked, blocked] = await Promise.all([
    loadBookedDateKeys(propertyId, today, endYmd),
    loadBlockedDateKeys(propertyId, today, endYmd),
  ]);
  const taken = new Set<string>([...booked, ...blocked]);
  const count = (days: number): number => {
    let n = 0;
    const base = new Date(`${today}T00:00:00Z`).getTime();
    for (let i = 0; i < days; i++) {
      if (taken.has(new Date(base + i * MS_PER_DAY).toISOString().slice(0, 10))) n += 1;
    }
    return Math.round((n / days) * 1000) / 1000;
  };
  return { d30: count(30), d60: count(60), d90: count(90) };
}

/**
 * Learn day-of-week and month demand curves from ~24 months of completed stays, plus the
 * live forward-occupancy ratios. Thin history (< 20 elapsed booked nights) → cold-start
 * fallback (`demandConfidence: 0`, neutral months, tiny weekend lift). Above that,
 * `demandConfidence` ramps 0→1 with booking volume so the curves earn their influence.
 */
export async function gatherHistoryFeatures(propertyId: string): Promise<SmartHistoryFeatures> {
  const supabase = createServiceClient();
  const today = manilaTodayYmd();
  const since = new Date(new Date(`${today}T00:00:00Z`).getTime() - 730 * MS_PER_DAY);

  const { data, error } = await supabase
    .from('guest_submissions')
    .select('check_in_date, check_out_date, number_of_nights, booking_rate, status')
    .eq('property_id', propertyId)
    .neq('status', 'CANCELLED')
    .neq('status', 'IMPORTED');
  if (error) throw new Error(`Failed to load booking history: ${error.message}`);

  const dowCount = [0, 0, 0, 0, 0, 0, 0];
  const monthCount = Array.from({ length: 12 }, () => 0);
  let totalNights = 0;
  const nightlyRates: number[] = [];
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();

  for (const row of data ?? []) {
    const checkIn = parseStayDate(row.check_in_date as string);
    const checkOut = parseStayDate(row.check_out_date as string);
    if (!checkIn || !checkOut || checkOut <= checkIn) continue;
    if (checkIn.getTime() < since.getTime()) continue;

    const rate = Number(row.booking_rate);
    const nights = Number(row.number_of_nights);
    if (Number.isFinite(rate) && rate > 0 && Number.isFinite(nights) && nights > 0) {
      nightlyRates.push(rate / nights);
    }

    for (let t = checkIn.getTime(); t < checkOut.getTime(); t += MS_PER_DAY) {
      const d = new Date(t);
      // Only count nights that have actually elapsed — future held nights are not "demand".
      if (t >= todayMs) continue;
      dowCount[d.getUTCDay()] += 1;
      monthCount[d.getUTCMonth()] += 1;
      totalNights += 1;
    }
  }

  const forward = await forwardOccupancy(propertyId, today);

  if (totalNights < 20) {
    return {
      confidence: 'low',
      // Lets ~half of the fixed cold-start weekend lift through (the month curve is neutral,
      // so this is the *only* thing it gates) — a small, universally-safe weekend premium
      // that clears the engine's 2% deadzone.
      demandConfidence: 0.5,
      dowDemand: COLD_START_DOW,
      monthDemand: NEUTRAL_MONTH,
      forwardOccupancy: forward,
      medianRealisedNightly: median(nightlyRates),
    };
  }

  // Tight clamps: a single day-of-week or month should never, on its own, justify a big
  // swing. The engine additionally caps the *product* of all algorithmic signals.
  const dowDemand = dowCount.map((c) => clamp(c / totalNights / (1 / 7), 0.88, 1.15));
  const monthDemand = monthCount.map((c) => clamp(c / totalNights / (1 / 12), 0.85, 1.2));

  return {
    confidence: 'high',
    demandConfidence: demandConfidenceFor(totalNights),
    dowDemand,
    monthDemand,
    forwardOccupancy: forward,
    medianRealisedNightly: median(nightlyRates),
  };
}

export { NEUTRAL_DOW, NEUTRAL_MONTH };
