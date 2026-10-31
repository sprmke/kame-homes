/**
 * Smart Pricing — deterministic nightly-rate engine.
 *
 * Pure: no DB, no network, no clock. `computeSmartRates()` takes a base price, host knobs,
 * and pre-extracted history features (see smartPricingData.ts) and returns one recommendation
 * per night in the window, each carrying a factor breakdown for the calendar tooltip.
 *
 * Model (industry-standard `base x product(multipliers)` clamped to `[min, max]`):
 *   raw = base(dow) x seasonDemand x dowDemand x seasonRule x leadTime x bookingPace x orphanGap
 *   recommended = round(clamp(raw, min, max))
 *
 * The LLM never sets these numbers — an optional AI pass (smartPricingAi.ts) only writes a
 * rationale and flags outliers.
 */

export type SmartAggressiveness = 'conservative' | 'balanced' | 'aggressive';
export type SmartRounding = 'r50' | 'r99' | 'r100' | 'none';

export type SmartSeasonRule = {
  id: string;
  name: string;
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  /** YYYY-MM-DD, inclusive. */
  endDate: string;
  /** +premium / -discount, percent. */
  percentage: number;
};

export type SmartLeadTimeTier = { days: number; pct: number };
export type SmartLeadTimeConfig = {
  /** e.g. [{ days: 3, pct: -18 }, { days: 7, pct: -10 }] — tightest matching tier wins. */
  lastMinute: SmartLeadTimeTier[];
  /** e.g. [{ days: 120, pct: 8 }] — only applied on premium (positive) season nights. */
  farOut: SmartLeadTimeTier[];
};

export type SmartHistoryFeatures = {
  /** 'low' = thin history; the caller suppresses lead-time + pace signals. */
  confidence: 'high' | 'low';
  /**
   * 0..1 — how much to trust the learned demand curves. Ramps with booking volume.
   * The engine blends `dowDemand` / `monthDemand` toward 1.0 by `(1 - demandConfidence)`,
   * so a listing with thin history barely moves off its base rate from demand alone.
   */
  demandConfidence: number;
  /** index 0=Sun..6=Sat — relative demand weight, ~1.0 = average. */
  dowDemand: number[];
  /** index 0=Jan..11=Dec — occupancy index, ~1.0 = average. */
  monthDemand: number[];
  /** forward occupancy ratios (0..1) over the next 30 / 60 / 90 nights. */
  forwardOccupancy: { d30: number; d60: number; d90: number };
  /** median realised nightly from history — sanity only, never applied. */
  medianRealisedNightly: number | null;
};

export type SmartRateFactor = { key: string; label: string; multiplier: number };

export type SmartRateSkip = 'past' | 'booked' | 'blocked' | 'locked';

export type SmartRateResult = {
  /** YYYY-MM-DD */
  date: string;
  /** 0=Sun..6=Sat */
  weekday: number;
  baseRate: number;
  recommendedRate: number;
  factors: SmartRateFactor[];
  clampedBy: 'min' | 'max' | null;
  /** Set when the night is not eligible for a recommendation (still returned, for context). */
  skipped: SmartRateSkip | null;
};

export type ComputeSmartRatesInput = {
  /** YYYY-MM-DD, Manila "today" — nights before this are skipped. */
  today: string;
  window: { start: string; end: string };
  base: { weekday: number; weekend: number };
  bounds: { min: number | null; max: number | null };
  aggressiveness: SmartAggressiveness;
  seasonRules: SmartSeasonRule[];
  /** "0".."6" -> percent, host adjustments layered on the learned day-of-week curve. */
  dowAdjust: Record<string, number>;
  leadTime: SmartLeadTimeConfig;
  orphanGapDiscountPct: number;
  occupancyTiltEnabled: boolean;
  rounding: SmartRounding;
  bookedDateKeys: Set<string>;
  blockedDateKeys: Set<string>;
  /** Host per-date overrides — never touched by the engine. */
  lockedDateKeys: Set<string>;
  history: SmartHistoryFeatures;
};

const MS_PER_DAY = 86_400_000;
/** How far a single multiplier may pull, per aggressiveness (deviation gain). */
const AGGRESSIVENESS_GAIN: Record<SmartAggressiveness, number> = {
  conservative: 0.5,
  balanced: 1,
  aggressive: 1.5,
};
/**
 * Hard cap on how far the *algorithmic* signals (day-of-week, season demand, lead-time,
 * booking pace) may move a night away from its base rate, per aggressiveness. The host's own
 * season/holiday rules and the orphan-gap fill are applied *on top* of this cap — an explicit
 * "Christmas +40%" rule is honoured, a learned demand curve can never swing a night by 40%.
 * This is what keeps Smart Pricing feeling safe: a new or low-volume listing sees small
 * nudges, never a blanket discount.
 */
const ALGO_DEVIATION_CAP: Record<SmartAggressiveness, number> = {
  conservative: 0.06,
  balanced: 0.12,
  aggressive: 0.22,
};
/** The orphan-gap discount is real (short gaps are genuinely hard to fill) but still bounded. */
const ORPHAN_MAX_DISCOUNT = 0.15;
/** Below this, a night is left at its base rate — no rec row, no calendar marker, no "change". */
const MIN_MEANINGFUL_DELTA = 0.02;
/** Booking-pace nudge only fires when the near window is nearly sold out, and only upward. */
const PACE_MIN_OCCUPANCY = 0.85;
const PACE_MAX_LIFT = 0.06;
/** Internal clamp when the host has not set a min/max, as a multiple of base. */
const IMPLICIT_MIN_FACTOR = 0.6;
const IMPLICIT_MAX_FACTOR = 2.5;

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/** Fri / Sat / Sun — matches propertyPricing.ts#isWeekendRateDay. */
function isWeekendDay(weekday: number): boolean {
  return weekday === 0 || weekday === 5 || weekday === 6;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

/** Scale a raw multiplier's deviation from 1.0 by the aggressiveness gain. */
function applyGain(multiplier: number, gain: number): number {
  return 1 + (multiplier - 1) * gain;
}

/** Turn a percent adjustment into a gain-scaled multiplier. */
function pctToMultiplier(pct: number, gain: number): number {
  return 1 + (pct / 100) * gain;
}

function findSeasonRule(dateKey: string, rules: SmartSeasonRule[]): SmartSeasonRule | undefined {
  return rules.find((r) => dateKey >= r.startDate && dateKey <= r.endDate);
}

function roundRate(value: number, rounding: SmartRounding): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  switch (rounding) {
    case 'r50':
      return Math.max(0, Math.round(value / 50) * 50);
    case 'r100':
      return Math.max(0, Math.round(value / 100) * 100);
    case 'r99':
      return Math.max(0, Math.round(value / 100) * 100 - 1);
    case 'none':
    default:
      return Math.round(value);
  }
}

/** Nearest forward-occupancy bucket for a lead time in days. */
function occupancyForLeadDays(
  daysOut: number,
  forward: SmartHistoryFeatures['forwardOccupancy']
): number {
  if (daysOut <= 30) return forward.d30;
  if (daysOut <= 60) return forward.d60;
  return forward.d90;
}

function leadTimeMultiplier(
  daysOut: number,
  occupancy: number,
  seasonRule: SmartSeasonRule | undefined,
  config: SmartLeadTimeConfig,
  gain: number
): { multiplier: number; label: string } | null {
  // Last-minute: only discount when the near window is genuinely soft.
  if (occupancy < 0.7) {
    const tiers = [...config.lastMinute].sort((a, b) => a.days - b.days);
    for (const tier of tiers) {
      if (daysOut <= tier.days) {
        return {
          multiplier: pctToMultiplier(tier.pct, gain),
          label: `Last-minute (≤${tier.days}d)`,
        };
      }
    }
  }
  // Far-out: only premium on already-premium (positive) season nights.
  if (seasonRule && seasonRule.percentage > 0) {
    const tiers = [...config.farOut].sort((a, b) => b.days - a.days);
    for (const tier of tiers) {
      if (daysOut >= tier.days) {
        return {
          multiplier: pctToMultiplier(tier.pct, gain),
          label: `Far-out peak (≥${tier.days}d)`,
        };
      }
    }
  }
  return null;
}

/**
 * 1–2 night unbooked gaps sandwiched between unavailable nights. Pre-computed once over the
 * whole window so per-night lookup is O(1).
 */
function computeOrphanNights(keys: string[], unavailable: Set<string>): Set<string> {
  const orphans = new Set<string>();
  let runStart = -1;
  for (let i = 0; i <= keys.length; i++) {
    const key = keys[i];
    const isUnavailable = key === undefined || unavailable.has(key);
    if (!isUnavailable && runStart === -1) {
      runStart = i;
    } else if (isUnavailable && runStart !== -1) {
      const runLen = i - runStart;
      const boundedLeft = runStart > 0 && unavailable.has(keys[runStart - 1]!);
      const boundedRight = key !== undefined && unavailable.has(key);
      if (runLen <= 2 && boundedLeft && boundedRight) {
        for (let j = runStart; j < i; j++) orphans.add(keys[j]!);
      }
      runStart = -1;
    }
  }
  return orphans;
}

export type SmartRunSummary = {
  nightsComputed: number;
  nightsChanged: number;
  avgDeltaPct: number;
};

export function summarizeSmartRates(results: SmartRateResult[]): SmartRunSummary {
  const eligible = results.filter((r) => r.skipped === null);
  if (eligible.length === 0) return { nightsComputed: 0, nightsChanged: 0, avgDeltaPct: 0 };
  let changed = 0;
  let deltaSum = 0;
  for (const r of eligible) {
    if (r.recommendedRate !== r.baseRate) changed += 1;
    if (r.baseRate > 0) deltaSum += (r.recommendedRate - r.baseRate) / r.baseRate;
  }
  return {
    nightsComputed: eligible.length,
    nightsChanged: changed,
    avgDeltaPct: Math.round((deltaSum / eligible.length) * 1000) / 10,
  };
}

export function computeSmartRates(input: ComputeSmartRatesInput): SmartRateResult[] {
  const gain = AGGRESSIVENESS_GAIN[input.aggressiveness];
  const today = parseYmd(input.today);
  const start = parseYmd(input.window.start);
  const end = parseYmd(input.window.end);

  const keys: string[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + MS_PER_DAY)) {
    keys.push(formatYmd(d));
  }

  const unavailable = new Set<string>([...input.bookedDateKeys, ...input.blockedDateKeys]);
  const orphanNights = computeOrphanNights(keys, unavailable);

  return keys.map((dateKey) => {
    const date = parseYmd(dateKey);
    const weekday = date.getUTCDay();
    const baseRate = isWeekendDay(weekday) ? input.base.weekend : input.base.weekday;

    let skipped: SmartRateSkip | null = null;
    if (diffDays(date, today) < 0) skipped = 'past';
    else if (input.lockedDateKeys.has(dateKey)) skipped = 'locked';
    else if (input.bookedDateKeys.has(dateKey)) skipped = 'booked';
    else if (input.blockedDateKeys.has(dateKey)) skipped = 'blocked';

    if (skipped) {
      return {
        date: dateKey,
        weekday,
        baseRate,
        recommendedRate: baseRate,
        factors: [],
        clampedBy: null,
        skipped,
      };
    }

    const factors: SmartRateFactor[] = [];
    const push = (key: string, label: string, multiplier: number) => {
      const m = Math.round(multiplier * 1000) / 1000;
      if (m !== 1) factors.push({ key, label, multiplier: m });
    };

    // Blend a learned demand index toward 1.0 by how much history we actually have.
    const trust = clamp01(input.history.demandConfidence);
    const blend = (index: number) => 1 + (index - 1) * trust;

    // ── Algorithmic signals (subject to ALGO_DEVIATION_CAP) ──────────────────
    // 1. Day-of-week demand (learned, confidence-blended) + host adjustment.
    const learnedDow = applyGain(blend(input.history.dowDemand[weekday] ?? 1), gain);
    const hostDowPct = Number(input.dowAdjust[String(weekday)] ?? 0);
    const dowMult = learnedDow * pctToMultiplier(hostDowPct, gain);
    push('dow', 'Day of week', dowMult);

    // 2. Seasonality (month occupancy index, confidence-blended).
    const monthMult = applyGain(blend(input.history.monthDemand[date.getUTCMonth()] ?? 1), gain);
    push('season_demand', 'Season demand', monthMult);

    // 3. Season / holiday rule range — the host's explicit intent, applied on top of the cap.
    const seasonRule = findSeasonRule(dateKey, input.seasonRules);
    if (seasonRule) {
      push('season_rule', seasonRule.name, pctToMultiplier(seasonRule.percentage, gain));
    }

    // 4. Lead time (last-minute discount / far-out premium).
    const daysOut = diffDays(date, today);
    const occupancy = occupancyForLeadDays(daysOut, input.history.forwardOccupancy);
    const lead = leadTimeMultiplier(daysOut, occupancy, seasonRule, input.leadTime, gain);
    if (lead) push('lead_time', lead.label, lead.multiplier);

    // 5. Booking pace — an *upward* nudge only, and only when the near window is nearly full.
    //    Low forward occupancy on a small listing is normal, not a distress signal, so we
    //    never discount for it.
    if (input.occupancyTiltEnabled && occupancy > PACE_MIN_OCCUPANCY) {
      const lift = Math.min(PACE_MAX_LIFT, occupancy - PACE_MIN_OCCUPANCY);
      push('pace', 'Selling fast', 1 + lift * gain);
    }

    // ── Structural signals (applied on top of the cap) ──────────────────────
    // 6. Orphan-gap fill discount — short gaps between bookings are genuinely hard to fill.
    if (orphanNights.has(dateKey)) {
      const raw = 1 - (input.orphanGapDiscountPct / 100) * gain;
      push('orphan', 'Gap night', Math.max(1 - ORPHAN_MAX_DISCOUNT, raw));
    }

    // Cap the *algorithmic* product; leave `season_rule` / `orphan` uncapped (bounded elsewhere).
    const cap = ALGO_DEVIATION_CAP[input.aggressiveness];
    const algoProduct = factors
      .filter((f) => f.key !== 'season_rule' && f.key !== 'orphan')
      .reduce((acc, f) => acc * f.multiplier, 1);
    const cappedAlgo = clamp(algoProduct, 1 - cap, 1 + cap);
    const structuralProduct = factors
      .filter((f) => f.key === 'season_rule' || f.key === 'orphan')
      .reduce((acc, f) => acc * f.multiplier, 1);

    let raw = baseRate * cappedAlgo * structuralProduct;

    // Hard floor of 1 so a mis-set `min` (or a near-zero base) can never yield a ₱0 rate.
    const min = Math.max(1, input.bounds.min ?? baseRate * IMPLICIT_MIN_FACTOR);
    const max = Math.max(min, input.bounds.max ?? baseRate * IMPLICIT_MAX_FACTOR);
    let clampedBy: 'min' | 'max' | null = null;
    if (raw < min) {
      raw = min;
      clampedBy = 'min';
    } else if (raw > max) {
      raw = max;
      clampedBy = 'max';
    }

    const rounded = roundRate(raw, input.rounding);
    // Deadzone: hosts do not care about a sub-2% nudge, and a rec row / calendar marker for
    // one is just noise. Snap it back to base unless the host's own season rule is what moved
    // it, or a bound clamped it.
    const hasRule = factors.some((f) => f.key === 'season_rule');
    const meaningful =
      hasRule ||
      clampedBy !== null ||
      Math.abs(rounded - baseRate) >= baseRate * MIN_MEANINGFUL_DELTA;
    const recommendedRate = meaningful ? rounded : baseRate;

    return {
      date: dateKey,
      weekday,
      baseRate,
      recommendedRate,
      factors,
      clampedBy,
      skipped: null,
    };
  });
}

/**
 * Sensible starting knobs for a property with no saved Smart Pricing config. Kept gentle:
 * last-minute discounts only bite in the final week, and there is no speculative far-out
 * premium (it was noise on properties that do not book months ahead).
 */
export function defaultLeadTimeConfig(): SmartLeadTimeConfig {
  return {
    lastMinute: [
      { days: 3, pct: -8 },
      { days: 7, pct: -4 },
    ],
    farOut: [],
  };
}
