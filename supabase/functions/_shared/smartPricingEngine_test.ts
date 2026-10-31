/**
 * Unit tests for the Smart Pricing deterministic engine.
 * Run: deno test supabase/functions/_shared/smartPricingEngine_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  computeSmartRates,
  defaultLeadTimeConfig,
  summarizeSmartRates,
  type ComputeSmartRatesInput,
  type SmartHistoryFeatures,
} from './smartPricingEngine.ts';

const NEUTRAL_HISTORY: SmartHistoryFeatures = {
  confidence: 'high',
  demandConfidence: 1,
  dowDemand: [1, 1, 1, 1, 1, 1, 1],
  monthDemand: Array.from({ length: 12 }, () => 1),
  forwardOccupancy: { d30: 0.5, d60: 0.5, d90: 0.5 },
  medianRealisedNightly: 3000,
};

function baseInput(over: Partial<ComputeSmartRatesInput> = {}): ComputeSmartRatesInput {
  return {
    today: '2026-03-01',
    window: { start: '2026-03-02', end: '2026-03-11' },
    base: { weekday: 2800, weekend: 3000 },
    bounds: { min: 2000, max: 6000 },
    aggressiveness: 'balanced',
    seasonRules: [],
    dowAdjust: {},
    leadTime: { lastMinute: [], farOut: [] },
    orphanGapDiscountPct: 15,
    occupancyTiltEnabled: false,
    rounding: 'r50',
    bookedDateKeys: new Set(),
    blockedDateKeys: new Set(),
    lockedDateKeys: new Set(),
    history: NEUTRAL_HISTORY,
    ...over,
  };
}

Deno.test('neutral inputs return the base rate unchanged', () => {
  const results = computeSmartRates(baseInput());
  for (const r of results) {
    assertEquals(r.skipped, null);
    assertEquals(r.recommendedRate, r.baseRate);
    assertEquals(r.factors.length, 0);
  }
});

Deno.test('weekend nights use the weekend base rate', () => {
  const results = computeSmartRates(baseInput());
  // 2026-03-06 is a Friday, 03-07 Sat, 03-08 Sun.
  const fri = results.find((r) => r.date === '2026-03-06')!;
  const mon = results.find((r) => r.date === '2026-03-09')!;
  assertEquals(fri.baseRate, 3000);
  assertEquals(mon.baseRate, 2800);
});

Deno.test('season rule premium raises the rate and is gain-scaled', () => {
  const balanced = computeSmartRates(
    baseInput({
      seasonRules: [
        {
          id: 'peak',
          name: 'Peak',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          percentage: 20,
        },
      ],
    })
  );
  const conservative = computeSmartRates(
    baseInput({
      aggressiveness: 'conservative',
      seasonRules: [
        {
          id: 'peak',
          name: 'Peak',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          percentage: 20,
        },
      ],
    })
  );
  const b = balanced.find((r) => r.date === '2026-03-02')!;
  const c = conservative.find((r) => r.date === '2026-03-02')!;
  // balanced: 2800 * 1.2 = 3360 -> r50 = 3350; conservative: 2800 * 1.1 = 3080 -> 3100.
  assertEquals(b.recommendedRate, 3350);
  assertEquals(c.recommendedRate, 3100);
  assert(b.recommendedRate > c.recommendedRate);
});

Deno.test('min / max bounds clamp the recommendation', () => {
  const high = computeSmartRates(
    baseInput({
      bounds: { min: 2000, max: 3200 },
      seasonRules: [
        { id: 'x', name: 'Huge', startDate: '2026-03-01', endDate: '2026-03-31', percentage: 200 },
      ],
    })
  );
  const r = high.find((x) => x.date === '2026-03-02')!;
  assertEquals(r.recommendedRate, 3200);
  assertEquals(r.clampedBy, 'max');
});

Deno.test('booked / blocked / locked / past nights are skipped, never repriced', () => {
  const results = computeSmartRates(
    baseInput({
      today: '2026-03-05',
      window: { start: '2026-03-01', end: '2026-03-11' },
      bookedDateKeys: new Set(['2026-03-07']),
      blockedDateKeys: new Set(['2026-03-08']),
      lockedDateKeys: new Set(['2026-03-09']),
      seasonRules: [
        { id: 'p', name: 'P', startDate: '2026-03-01', endDate: '2026-03-31', percentage: 30 },
      ],
    })
  );
  assertEquals(results.find((r) => r.date === '2026-03-02')!.skipped, 'past');
  assertEquals(results.find((r) => r.date === '2026-03-07')!.skipped, 'booked');
  assertEquals(results.find((r) => r.date === '2026-03-08')!.skipped, 'blocked');
  assertEquals(results.find((r) => r.date === '2026-03-09')!.skipped, 'locked');
  for (const r of results) {
    if (r.skipped) assertEquals(r.recommendedRate, r.baseRate);
  }
});

Deno.test('orphan gap between two bookings is discounted', () => {
  const results = computeSmartRates(
    baseInput({
      today: '2026-03-01',
      window: { start: '2026-03-02', end: '2026-03-12' },
      // Bookings 03-04..03-05 and 03-07..03-08 leave 03-06 as a 1-night orphan.
      bookedDateKeys: new Set(['2026-03-04', '2026-03-05', '2026-03-07', '2026-03-08']),
      orphanGapDiscountPct: 20,
    })
  );
  const orphan = results.find((r) => r.date === '2026-03-06')!;
  assert(orphan.factors.some((f) => f.key === 'orphan'));
  assert(orphan.recommendedRate < orphan.baseRate);
});

Deno.test('last-minute discount only applies when the near window is soft', () => {
  const soft = computeSmartRates(
    baseInput({
      today: '2026-03-01',
      window: { start: '2026-03-02', end: '2026-03-04' },
      history: { ...NEUTRAL_HISTORY, forwardOccupancy: { d30: 0.4, d60: 0.4, d90: 0.4 } },
      leadTime: { lastMinute: [{ days: 5, pct: -20 }], farOut: [] },
    })
  );
  const busy = computeSmartRates(
    baseInput({
      today: '2026-03-01',
      window: { start: '2026-03-02', end: '2026-03-04' },
      history: { ...NEUTRAL_HISTORY, forwardOccupancy: { d30: 0.9, d60: 0.9, d90: 0.9 } },
      leadTime: { lastMinute: [{ days: 5, pct: -20 }], farOut: [] },
    })
  );
  assert(soft.find((r) => r.date === '2026-03-02')!.factors.some((f) => f.key === 'lead_time'));
  assert(!busy.find((r) => r.date === '2026-03-02')!.factors.some((f) => f.key === 'lead_time'));
});

Deno.test('summarizeSmartRates reports changed nights and average delta', () => {
  const results = computeSmartRates(
    baseInput({
      seasonRules: [
        { id: 'p', name: 'P', startDate: '2026-03-01', endDate: '2026-03-31', percentage: 10 },
      ],
    })
  );
  const summary = summarizeSmartRates(results);
  assertEquals(summary.nightsComputed, results.length);
  assert(summary.nightsChanged > 0);
  assert(summary.avgDeltaPct > 0);
});

Deno.test('defaultLeadTimeConfig is well-formed and gentle', () => {
  const cfg = defaultLeadTimeConfig();
  assert(cfg.lastMinute.length > 0);
  assert(cfg.lastMinute.every((t) => t.pct < 0 && t.pct >= -10));
  assertEquals(cfg.farOut.length, 0);
});

Deno.test('algorithmic signals are capped — a harsh demand curve cannot slam a night', () => {
  // dowDemand 0.6 + monthDemand 0.6 would multiply to 0.36 (−64%) uncapped.
  const harsh = computeSmartRates(
    baseInput({
      bounds: { min: 1, max: 999999 },
      history: {
        ...NEUTRAL_HISTORY,
        dowDemand: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6],
        monthDemand: Array.from({ length: 12 }, () => 0.6),
      },
    })
  );
  for (const r of harsh) {
    // balanced cap = ±12%, plus one r50 rounding step of slack.
    assert(
      r.recommendedRate >= r.baseRate * 0.88 - 50,
      `${r.date} ${r.recommendedRate} fell below the balanced cap`
    );
  }
});

Deno.test('thin history barely moves prices even with an empty forward calendar', () => {
  const results = computeSmartRates(
    baseInput({
      // demandConfidence 0 → curves blend fully to 1.0; no lead-time, no pace.
      history: {
        ...NEUTRAL_HISTORY,
        confidence: 'low',
        demandConfidence: 0,
        dowDemand: [1.04, 0.98, 0.98, 0.98, 0.98, 1.04, 1.06],
        forwardOccupancy: { d30: 0, d60: 0, d90: 0 },
      },
      leadTime: { lastMinute: [], farOut: [] },
      occupancyTiltEnabled: false,
    })
  );
  for (const r of results) {
    assert(
      Math.abs(r.recommendedRate - r.baseRate) <= r.baseRate * 0.05 + 1,
      `${r.date} moved ${r.recommendedRate - r.baseRate} on thin history`
    );
  }
});

Deno.test('a sub-2% nudge is snapped back to base (deadzone)', () => {
  const results = computeSmartRates(
    baseInput({
      // dowDemand 1.03 on every day → +3% raw, ×gain 1 → well under the cap but a real nudge.
      history: {
        ...NEUTRAL_HISTORY,
        dowDemand: [1.015, 1.015, 1.015, 1.015, 1.015, 1.015, 1.015],
      },
    })
  );
  for (const r of results) {
    // 2800 × 1.015 ≈ 2842 (+1.5%) — below MIN_MEANINGFUL_DELTA, so left at base.
    assertEquals(r.recommendedRate, r.baseRate);
  }
});

Deno.test('a host season rule is honoured beyond the algorithmic cap', () => {
  const results = computeSmartRates(
    baseInput({
      bounds: { min: 1, max: 999999 },
      seasonRules: [
        {
          id: 'xmas',
          name: 'Christmas',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          percentage: 40,
        },
      ],
    })
  );
  const r = results.find((x) => x.date === '2026-03-02')!;
  // 2800 × 1.40 = 3920 → r50 3900 — well past the ±12% algo cap.
  assertEquals(r.recommendedRate, 3900);
});
