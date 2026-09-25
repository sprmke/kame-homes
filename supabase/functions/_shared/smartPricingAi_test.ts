/**
 * Unit tests for the Smart Pricing AI pass — the pure helpers that shape the "populated"
 * (Gemini returned JSON) path. The fetch/quota wrapper in maybeRunSmartPricingAi() is the
 * standard repo pattern shared by 6 other AI features and is not covered here.
 * Run: deno test supabase/functions/_shared/smartPricingAi_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildSmartPricingAiPrompt,
  parseSmartPricingAiJson,
  shapeSmartPricingAiOutput,
} from './smartPricingAi.ts';
import type { SmartPricingComputation } from './smartPricingRun.ts';
import { DEFAULT_SMART_PRICING_SETTINGS } from './smartPricing.ts';

function comp(over: Partial<SmartPricingComputation> = {}): SmartPricingComputation {
  return {
    windowStart: '2026-03-02',
    windowEnd: '2027-03-02',
    base: { weekday: 2800, weekend: 3000 },
    settings: { ...DEFAULT_SMART_PRICING_SETTINGS },
    historyConfidence: 'high',
    results: [
      {
        date: '2026-03-02',
        weekday: 1,
        baseRate: 2800,
        recommendedRate: 3100,
        factors: [],
        clampedBy: null,
        skipped: null,
      },
      {
        date: '2026-03-03',
        weekday: 2,
        baseRate: 2800,
        recommendedRate: 3050,
        factors: [],
        clampedBy: null,
        skipped: null,
      },
      {
        date: '2026-04-10',
        weekday: 5,
        baseRate: 3000,
        recommendedRate: 2600,
        factors: [],
        clampedBy: null,
        skipped: null,
      },
      {
        date: '2026-04-11',
        weekday: 6,
        baseRate: 3000,
        recommendedRate: 2500,
        factors: [],
        clampedBy: null,
        skipped: null,
      },
      {
        date: '2026-05-01',
        weekday: 5,
        baseRate: 3000,
        recommendedRate: 3000,
        factors: [],
        clampedBy: null,
        skipped: 'booked',
      },
    ],
    summary: { nightsComputed: 4, nightsChanged: 4, avgDeltaPct: 1.2 },
    ...over,
  };
}

Deno.test('buildSmartPricingAiPrompt: system forbids setting prices + covers month buckets', () => {
  const { system, user } = buildSmartPricingAiPrompt(comp());
  assert(system.includes('You do NOT set prices') || system.toLowerCase().includes('do not set'));
  assert(system.includes('seasonRationales'));
  assert(system.includes('suggestedMinPrice'));
  // March + April buckets, skipped night excluded.
  assert(user.includes('2026-03: PHP 2800 -> PHP 3075 (2 nights)'));
  assert(user.includes('2026-04: PHP 3000 -> PHP 2550 (2 nights)'));
  assert(!user.includes('2026-05'));
  assert(user.includes('Host min price: not set'));
});

Deno.test('buildSmartPricingAiPrompt: reflects host bounds + season rules when set', () => {
  const { user } = buildSmartPricingAiPrompt(
    comp({
      settings: {
        ...DEFAULT_SMART_PRICING_SETTINGS,
        minPrice: 2000,
        maxPrice: 6000,
        seasonRules: [
          { id: 'x', name: 'Peak', startDate: '2026-04-01', endDate: '2026-04-30', percentage: 25 },
        ],
      },
    })
  );
  assert(user.includes('Host min price: 2000. Host max price: 6000.'));
  assert(user.includes('Season rules: Peak 2026-04-01..2026-04-30 +25%'));
});

Deno.test('parseSmartPricingAiJson: bare, fenced, and embedded JSON', () => {
  const w = (v: unknown) => (v as { warnings: string[] }).warnings;
  assertEquals(w(parseSmartPricingAiJson('{"warnings":["a"]}')), ['a']);
  assertEquals(w(parseSmartPricingAiJson('```json\n{"warnings":["b"]}\n```')), ['b']);
  assertEquals(w(parseSmartPricingAiJson('Here you go:\n{"warnings":["c"]}\nHope that helps')), [
    'c',
  ]);
});

Deno.test('shapeSmartPricingAiOutput: clamps counts + lengths, drops malformed entries', () => {
  const raw = {
    seasonRationales: [
      { label: 'Christmas', text: 'Peak demand — priced up.' },
      { label: '', text: 'no label' },
      { label: 'x', text: '' },
      { label: 'L'.repeat(80), text: 'T'.repeat(300) },
      { label: 'a', text: 'a' },
      { label: 'b', text: 'b' },
      { label: 'c', text: 'c' },
    ],
    warnings: ['w1', 42, 'w2', '', 'w3', 'w4', 'w5'],
    suggestedMinPrice: 2100.7,
    suggestedMaxPrice: -5,
  };
  const out = shapeSmartPricingAiOutput(raw, false, false);
  assertEquals(out.seasonRationales.length, 5); // capped at 5 (malformed entries dropped first)
  assertEquals(out.seasonRationales[0], { label: 'Christmas', text: 'Peak demand — priced up.' });
  assertEquals(out.seasonRationales[1].label.length, 60); // over-long label sliced
  assertEquals(out.seasonRationales[1].text.length, 240); // over-long text sliced
  assertEquals(out.warnings, ['w1', 'w2', 'w3', 'w4']); // non-strings + empty dropped, capped at 4
  assertEquals(out.suggestedMinPrice, 2101); // rounded
  assertEquals(out.suggestedMaxPrice, null); // negative -> null
});

Deno.test('shapeSmartPricingAiOutput: blank-only min/max suggestions', () => {
  const raw = {
    seasonRationales: [],
    warnings: [],
    suggestedMinPrice: 2000,
    suggestedMaxPrice: 9000,
  };
  assertEquals(shapeSmartPricingAiOutput(raw, true, true).suggestedMinPrice, null);
  assertEquals(shapeSmartPricingAiOutput(raw, true, true).suggestedMaxPrice, null);
  assertEquals(shapeSmartPricingAiOutput(raw, false, false).suggestedMinPrice, 2000);
  assertEquals(shapeSmartPricingAiOutput(raw, false, false).suggestedMaxPrice, 9000);
});

Deno.test('shapeSmartPricingAiOutput: garbage input -> safe empty shape', () => {
  const out = shapeSmartPricingAiOutput({ note: 'I cannot help' }, false, false);
  assertEquals(out, {
    seasonRationales: [],
    warnings: [],
    suggestedMinPrice: null,
    suggestedMaxPrice: null,
  });
  assertEquals(shapeSmartPricingAiOutput(null, false, false).warnings, []);
  assertEquals(shapeSmartPricingAiOutput('nope', false, false).seasonRationales, []);
});

Deno.test('shapeSmartPricingAiOutput: suggested bounds are clamped to the base rate', () => {
  const base = { weekday: 3000, weekend: 4000 };
  const shape = (min: number, max: number) =>
    shapeSmartPricingAiOutput(
      { seasonRationales: [], warnings: [], suggestedMinPrice: min, suggestedMaxPrice: max },
      false,
      false,
      base
    );
  // Sensible floor/ceiling pass through.
  assertEquals([shape(2000, 11000).suggestedMinPrice, shape(2000, 11000).suggestedMaxPrice], [
    2000, 11000,
  ]);
  // Absurd floor (below 0.3x) and ceiling (above 5x) are dropped.
  assertEquals(shape(100, 90000).suggestedMinPrice, null);
  assertEquals(shape(100, 90000).suggestedMaxPrice, null);
  // Inverted pair is dropped entirely.
  assertEquals([shape(3900, 3500).suggestedMinPrice, shape(3900, 3500).suggestedMaxPrice], [
    null,
    null,
  ]);
});
