/**
 * Smart Pricing — run orchestrator.
 *
 * Ties settings + property pricing + learned history to the pure engine, and owns
 * persistence for the three entry points:
 *   - preview  (manual)  → freeze the full result set on a `runs.payload`, apply nothing
 *   - apply    (manual)  → replay a frozen run into `recommendations` (applied=true), re-checking availability
 *   - autopilot (cron)   → compute + apply in one step
 *
 * The canonical `property_smart_pricing_recommendations` table only ever holds APPLIED rows.
 */

import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { createServiceClient } from './orgAuth.ts';
import { loadPropertyPricing } from './propertyPricing.ts';
import {
  computeSmartRates,
  summarizeSmartRates,
  type SmartRateResult,
  type SmartRunSummary,
  type SmartSeasonRule,
} from './smartPricingEngine.ts';
import {
  gatherHistoryFeatures,
  loadSmartPricingSettings,
  type SmartPricingSettings,
} from './smartPricing.ts';

const MS_PER_DAY = 86_400_000;
const nowIso = () => new Date().toISOString();

export type SmartPricingAiOutput = {
  seasonRationales: Array<{ label: string; text: string }>;
  warnings: string[];
  suggestedMinPrice: number | null;
  suggestedMaxPrice: number | null;
};

export type SmartPricingComputation = {
  windowStart: string;
  windowEnd: string;
  base: { weekday: number; weekend: number };
  settings: SmartPricingSettings;
  historyConfidence: 'high' | 'low';
  results: SmartRateResult[];
  summary: SmartRunSummary;
};

function ymdPlusDays(ymd: string, days: number): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

function seasonRulesFor(
  settings: SmartPricingSettings,
  holidayRules: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    percentage: number;
  }>
): SmartSeasonRule[] {
  if (settings.seasonRules.length > 0) return settings.seasonRules;
  return holidayRules.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    percentage: r.percentage,
  }));
}

/** Compute (no persistence) the recommended rate for every night in the forward window. */
export async function computeSmartPricingForProperty(
  propertyId: string
): Promise<SmartPricingComputation> {
  const [settings, pricing, history] = await Promise.all([
    loadSmartPricingSettings(propertyId),
    loadPropertyPricing(propertyId),
    gatherHistoryFeatures(propertyId),
  ]);

  const base = {
    weekday:
      settings.baseSource === 'custom' && settings.baseWeekday != null
        ? settings.baseWeekday
        : pricing.weekdayNightlyRate,
    weekend:
      settings.baseSource === 'custom' && settings.baseWeekend != null
        ? settings.baseWeekend
        : pricing.weekendNightlyRate,
  };

  const today = manilaTodayYmd();
  const windowStart = ymdPlusDays(today, 1);
  const windowEnd = ymdPlusDays(today, Math.max(30, settings.windowDays));

  // Thin history: lead-time and pace signals need booking volume to mean anything, so
  // suppress them until the listing has a track record. The engine's per-night deviation cap
  // + `demandConfidence` blend already keep the demand curves gentle, so the host's chosen
  // aggressiveness is safe to respect as-is.
  const thin = history.confidence === 'low';

  const results = computeSmartRates({
    today,
    window: { start: windowStart, end: windowEnd },
    base,
    bounds: { min: settings.minPrice, max: settings.maxPrice },
    aggressiveness: settings.aggressiveness,
    seasonRules: seasonRulesFor(settings, pricing.holidayRules),
    dowAdjust: settings.dowAdjust,
    leadTime: thin ? { lastMinute: [], farOut: [] } : settings.leadTime,
    orphanGapDiscountPct: settings.orphanGapDiscountPct,
    occupancyTiltEnabled: thin ? false : settings.occupancyTiltEnabled,
    rounding: settings.rounding,
    bookedDateKeys: new Set(pricing.bookedDateKeys),
    blockedDateKeys: new Set(pricing.blockedDateKeys),
    lockedDateKeys: new Set(Object.keys(pricing.dateOverrides)),
    history,
  });

  return {
    windowStart,
    windowEnd,
    base,
    settings,
    historyConfidence: history.confidence,
    results,
    summary: summarizeSmartRates(results),
  };
}

type RunRow = {
  id: string;
  property_id: string;
  payload: SmartRateResult[] | null;
};

async function insertRun(
  propertyId: string,
  trigger: 'cron' | 'manual_preview' | 'manual_apply',
  comp: Pick<SmartPricingComputation, 'windowStart' | 'windowEnd' | 'summary'>,
  extra: Record<string, unknown>
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_smart_pricing_runs')
    .insert({
      property_id: propertyId,
      trigger,
      window_start: comp.windowStart,
      window_end: comp.windowEnd,
      nights_computed: comp.summary.nightsComputed,
      nights_changed: comp.summary.nightsChanged,
      avg_delta_pct: comp.summary.avgDeltaPct,
      ...extra,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to record Smart Pricing run: ${error.message}`);
  return data.id as string;
}

/**
 * Upsert the settings row and stamp `last_run_at`. `activate` is set when the host explicitly
 * applies a run (manual apply / autopilot) — applying a recommendation IS the intent to make
 * Smart Pricing live, so the read-side merge (`loadAppliedSmartRecommendations`, gated on
 * `enabled`) actually takes effect. A bare preview never activates.
 */
async function touchLastRun(propertyId: string, activate: boolean): Promise<void> {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {
    property_id: propertyId,
    last_run_at: nowIso(),
    updated_at: nowIso(),
  };
  if (activate) patch.enabled = true;
  const { error } = await supabase
    .from('property_smart_pricing_settings')
    .upsert(patch, { onConflict: 'property_id' });
  if (error) {
    console.warn('[smartPricingRun] touchLastRun upsert failed (non-fatal):', error.message);
  }
}

/** Persist a preview run — freezes the full result set, applies nothing. */
export async function persistPreviewRun(
  propertyId: string,
  comp: SmartPricingComputation,
  opts?: { createdBy?: string | null; ai?: SmartPricingAiOutput | null; creditsConsumed?: number }
): Promise<string> {
  return insertRun(propertyId, 'manual_preview', comp, {
    payload: comp.results,
    ai_used: Boolean(opts?.ai),
    credits_consumed: opts?.creditsConsumed ?? 0,
    ai_warnings: opts?.ai?.warnings ?? null,
    ai_rationales: opts?.ai?.seasonRationales ?? null,
    suggested_min_price: opts?.ai?.suggestedMinPrice ?? null,
    suggested_max_price: opts?.ai?.suggestedMaxPrice ?? null,
    created_by: opts?.createdBy ?? null,
  });
}

function inRanges(date: string, ranges?: Array<{ start: string; end: string }>): boolean {
  if (!ranges || ranges.length === 0) return true;
  return ranges.some((r) => date >= r.start && date <= r.end);
}

function toRecRow(
  propertyId: string,
  runId: string,
  r: SmartRateResult,
  source: 'engine' | 'engine_ai'
) {
  return {
    property_id: propertyId,
    pricing_date: r.date,
    base_rate: r.baseRate,
    recommended_rate: r.recommendedRate,
    factors: r.factors,
    applied: true,
    applied_at: nowIso(),
    source,
    run_id: runId,
    updated_at: nowIso(),
  };
}

/**
 * Persist a fresh recommendation set with NO window where the property has zero applied rows:
 * upsert the new rows first (the `(property_id, pricing_date)` PK makes a concurrent apply
 * idempotent rather than a 23505 crash), then prune whatever the new set superseded.
 * A prune failure is non-fatal — the upsert already landed the correct rates; stale rows for
 * out-of-window dates get superseded on the next run.
 */
async function writeRecs(
  propertyId: string,
  rows: ReturnType<typeof toRecRow>[],
  scope: { kind: 'all' } | { kind: 'ranges'; ranges: Array<{ start: string; end: string }> }
): Promise<void> {
  const supabase = createServiceClient();

  if (rows.length > 0) {
    const { error } = await supabase
      .from('property_smart_pricing_recommendations')
      .upsert(rows, { onConflict: 'property_id,pricing_date' });
    if (error) throw new Error(`Failed to write Smart Pricing rates: ${error.message}`);
  }

  let del = supabase
    .from('property_smart_pricing_recommendations')
    .delete()
    .eq('property_id', propertyId);
  if (scope.kind === 'ranges') {
    del = del.or(
      scope.ranges
        .map((r) => `and(pricing_date.gte.${r.start},pricing_date.lte.${r.end})`)
        .join(',')
    );
  }
  const keepDates = rows.map((r) => r.pricing_date);
  if (keepDates.length > 0) {
    del = del.not('pricing_date', 'in', `(${keepDates.join(',')})`);
  }
  const { error } = await del;
  if (error) {
    console.warn('[smartPricingRun] prune stale recs failed (non-fatal):', error.message);
  }
}

/** Replay a frozen preview run into `recommendations` as applied rows, re-checking availability. */
export async function applyRun(
  propertyId: string,
  runId: string,
  opts?: { ranges?: Array<{ start: string; end: string }>; createdBy?: string | null }
): Promise<{ applied: number; skippedUnavailable: number }> {
  const supabase = createServiceClient();

  const { data: run, error: runError } = await supabase
    .from('property_smart_pricing_runs')
    .select('id, property_id, payload')
    .eq('id', runId)
    .maybeSingle();
  if (runError) throw new Error(runError.message);
  if (!run || (run as RunRow).property_id !== propertyId) {
    throw new Error('Smart Pricing run not found');
  }
  const payload = (run as RunRow).payload;
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('This Smart Pricing run has nothing to apply');
  }

  // Re-check availability as of now — a night booked/blocked/locked since the preview is skipped.
  const pricing = await loadPropertyPricing(propertyId);
  const booked = new Set(pricing.bookedDateKeys);
  const blocked = new Set(pricing.blockedDateKeys);
  const locked = new Set(Object.keys(pricing.dateOverrides));
  const today = manilaTodayYmd();

  const rows: ReturnType<typeof toRecRow>[] = [];
  let skippedUnavailable = 0;
  for (const r of payload) {
    if (r.skipped !== null) continue;
    // Only persist nights the engine actually moved — an unchanged night resolves to the
    // host's base rate anyway, and a rec row there would mark the calendar misleadingly.
    if (r.recommendedRate === r.baseRate) continue;
    if (!inRanges(r.date, opts?.ranges)) continue;
    if (r.date <= today || booked.has(r.date) || blocked.has(r.date) || locked.has(r.date)) {
      skippedUnavailable += 1;
      continue;
    }
    rows.push(toRecRow(propertyId, runId, r, 'engine'));
  }

  await writeRecs(
    propertyId,
    rows,
    opts?.ranges && opts.ranges.length > 0
      ? { kind: 'ranges', ranges: opts.ranges }
      : { kind: 'all' }
  );

  const appliedDates = rows.map((r) => r.pricing_date).sort();
  await insertRun(
    propertyId,
    'manual_apply',
    {
      windowStart: appliedDates[0] ?? payload[0]!.date,
      windowEnd: appliedDates[appliedDates.length - 1] ?? payload[payload.length - 1]!.date,
      summary: { nightsComputed: rows.length, nightsChanged: rows.length, avgDeltaPct: 0 },
    },
    { created_by: opts?.createdBy ?? null }
  );
  await touchLastRun(propertyId, true);

  return { applied: rows.length, skippedUnavailable };
}

/**
 * Apply a computation as autopilot output (cron). Pass `comp` to reuse a computation the
 * caller already ran (e.g. so the AI pass can inspect it first); omit it to compute fresh.
 */
export async function runAutopilotForProperty(
  propertyId: string,
  opts?: {
    comp?: SmartPricingComputation;
    ai?: SmartPricingAiOutput | null;
    creditsConsumed?: number;
  }
): Promise<{ runId: string; applied: number; summary: SmartRunSummary }> {
  const comp = opts?.comp ?? (await computeSmartPricingForProperty(propertyId));

  const source: 'engine' | 'engine_ai' = opts?.ai ? 'engine_ai' : 'engine';
  const runId = await insertRun(propertyId, 'cron', comp, {
    ai_used: Boolean(opts?.ai),
    credits_consumed: opts?.creditsConsumed ?? 0,
    ai_warnings: opts?.ai?.warnings ?? null,
    ai_rationales: opts?.ai?.seasonRationales ?? null,
    suggested_min_price: opts?.ai?.suggestedMinPrice ?? null,
    suggested_max_price: opts?.ai?.suggestedMaxPrice ?? null,
  });

  const rows = comp.results
    .filter((r) => r.skipped === null && r.recommendedRate !== r.baseRate)
    .map((r) => toRecRow(propertyId, runId, r, source));

  await writeRecs(propertyId, rows, { kind: 'all' });
  await touchLastRun(propertyId, true);

  return { runId, applied: rows.length, summary: comp.summary };
}

/** Drop every recommendation for a property (revert to manual rates). */
export async function clearRecommendations(propertyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('property_smart_pricing_recommendations')
    .delete()
    .eq('property_id', propertyId);
  if (error) throw new Error(`Failed to clear Smart Pricing: ${error.message}`);
}
