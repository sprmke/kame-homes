/**
 * Smart Pricing — optional AI rationale + sanity pass (via the AI gateway).
 *
 * Additive only: takes the deterministic engine's computed curve and returns
 *   - a short plain-language rationale per season bucket
 *   - warnings where the curve looks off vs. the property's realised history
 *   - suggested min / max price when the host left them blank
 * It NEVER changes a rate. Any failure (no keys, quota, kill switch, invalid output) → null,
 * and the caller falls back to engine-only output.
 */

import { z } from 'zod';

import { generateStructured, parseModelJson } from './ai/llmClient.ts';
import { definePrompt } from './ai/prompt.ts';
import { assertOrgAndPropertyAiQuota, resolveOrgIdForProperty } from './aiUsageService.ts';
import type { SmartPricingAiOutput, SmartPricingComputation } from './smartPricingRun.ts';

const FEATURE = 'smart_pricing' as const;

export const SMART_PRICING_PROMPT = definePrompt({
  id: 'smart_pricing_rationale',
  version: '2026-09-24.1',
});

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    seasonRationales: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          text: { type: 'STRING' },
        },
        required: ['label', 'text'],
      },
    },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    suggestedMinPrice: { type: 'NUMBER' },
    suggestedMaxPrice: { type: 'NUMBER' },
  },
  required: ['seasonRationales', 'warnings'],
} as const;

type MonthBucket = {
  month: string;
  nights: number;
  avgBase: number;
  avgRecommended: number;
};

function monthBuckets(comp: SmartPricingComputation): MonthBucket[] {
  const map = new Map<string, { nights: number; base: number; rec: number }>();
  for (const r of comp.results) {
    if (r.skipped !== null) continue;
    const key = r.date.slice(0, 7);
    const acc = map.get(key) ?? { nights: 0, base: 0, rec: 0 };
    acc.nights += 1;
    acc.base += r.baseRate;
    acc.rec += r.recommendedRate;
    map.set(key, acc);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      nights: v.nights,
      avgBase: Math.round(v.base / v.nights),
      avgRecommended: Math.round(v.rec / v.nights),
    }));
}

export function buildSmartPricingAiPrompt(comp: SmartPricingComputation): {
  system: string;
  user: string;
} {
  const s = comp.settings;
  const buckets = monthBuckets(comp);
  const system = [
    "You are a vacation-rental revenue analyst. You are given a deterministic pricing engine's",
    'output for one property and its own booking history. You do NOT set prices.',
    'Return ONLY JSON matching the schema. Rules:',
    '- seasonRationales: 2-5 short (<=160 char) plain-language notes a host can read, one per',
    '  notable month/season, explaining why that period is priced up or down.',
    '- warnings: 0-4 short flags where the recommended curve looks off vs. the realised history',
    "  (e.g. a known peak month barely moved, or a discount below the host's realised median).",
    '- suggestedMinPrice / suggestedMaxPrice: ONLY when the host has not set them — a sensible',
    '  floor (~0.6-0.75x base) and ceiling (~2.5-3.5x base) in PHP. Omit when already set.',
    '- Never invent facts. Never tell the host to leave the platform. Keep a professional tone.',
  ].join('\n');

  const user = [
    `Property base rate: weekday PHP ${comp.base.weekday}, weekend PHP ${comp.base.weekend}.`,
    `History confidence: ${comp.historyConfidence}.`,
    `Host min price: ${s.minPrice ?? 'not set'}. Host max price: ${s.maxPrice ?? 'not set'}.`,
    `Aggressiveness: ${s.aggressiveness}. Rounding: ${s.rounding}.`,
    `Engine summary: ${comp.summary.nightsChanged}/${comp.summary.nightsComputed} nights changed, avg ${comp.summary.avgDeltaPct}%.`,
    'Month buckets (avg base -> avg recommended, nights):',
    ...buckets.map(
      (b) => `  ${b.month}: PHP ${b.avgBase} -> PHP ${b.avgRecommended} (${b.nights} nights)`
    ),
    s.seasonRules.length > 0
      ? `Season rules: ${s.seasonRules.map((r) => `${r.name} ${r.startDate}..${r.endDate} ${r.percentage > 0 ? '+' : ''}${r.percentage}%`).join('; ')}`
      : 'Season rules: using the property holiday-rule defaults.',
    'Emit one JSON object.',
  ].join('\n');

  return { system, user };
}

/** Tolerant JSON parse (bare, fenced or embedded). Throws when nothing parses. */
export function parseSmartPricingAiJson(text: string): unknown {
  const parsed = parseModelJson(text);
  if (parsed === undefined) throw new SyntaxError('Smart pricing AI returned no JSON');
  return parsed;
}

/**
 * Business-rule bounds for the model's suggested floor/ceiling, relative to the property's own
 * base rates: floor within [0.3x, 1x] of base, ceiling within [1x, 5x], and floor < ceiling.
 * Anything outside is dropped rather than shown to the host.
 */
function clampSuggestedBounds(
  min: number | null,
  max: number | null,
  base: { weekday: number; weekend: number } | undefined
): { min: number | null; max: number | null } {
  if (!base) return { min, max };
  const low = Math.min(base.weekday, base.weekend);
  const high = Math.max(base.weekday, base.weekend);
  if (!(low > 0)) return { min, max };
  const safeMin = min != null && min >= low * 0.3 && min <= high ? min : null;
  const safeMax = max != null && max >= low && max <= high * 5 ? max : null;
  if (safeMin != null && safeMax != null && safeMin >= safeMax) return { min: null, max: null };
  return { min: safeMin, max: safeMax };
}

export function shapeSmartPricingAiOutput(
  raw: unknown,
  hostMinSet: boolean,
  hostMaxSet: boolean,
  baseRate?: { weekday: number; weekend: number }
): SmartPricingAiOutput {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rationales = Array.isArray(obj.seasonRationales) ? obj.seasonRationales : [];
  const warnings = Array.isArray(obj.warnings) ? obj.warnings : [];
  const numOrNull = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const bounds = clampSuggestedBounds(
    hostMinSet ? null : numOrNull(obj.suggestedMinPrice),
    hostMaxSet ? null : numOrNull(obj.suggestedMaxPrice),
    baseRate
  );
  return {
    seasonRationales: rationales
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => ({
        label: String(r.label ?? '').slice(0, 60),
        text: String(r.text ?? '').slice(0, 240),
      }))
      .filter((r) => r.label && r.text)
      .slice(0, 5),
    warnings: warnings
      .filter((w): w is string => typeof w === 'string')
      .map((w) => w.slice(0, 240))
      .filter(Boolean)
      .slice(0, 4),
    suggestedMinPrice: bounds.min,
    suggestedMaxPrice: bounds.max,
  };
}

/** Structural contract; caps, rounding and price bounds are applied in shapeSmartPricingAiOutput. */
const SmartPricingAiResponse = z
  .object({
    seasonRationales: z.array(z.unknown()),
    warnings: z.array(z.unknown()),
    suggestedMinPrice: z.number().nullable().optional(),
    suggestedMaxPrice: z.number().nullable().optional(),
  })
  .passthrough();

export type SmartPricingAiResult = {
  output: SmartPricingAiOutput;
  creditsConsumed: number;
};

/** Attempt the AI pass. Returns null on any failure — caller uses engine-only output. */
export async function maybeRunSmartPricingAi(
  propertyId: string,
  comp: SmartPricingComputation
): Promise<SmartPricingAiResult | null> {
  const organizationId = await resolveOrgIdForProperty(propertyId);
  if (!organizationId) return null;

  try {
    await assertOrgAndPropertyAiQuota(organizationId, propertyId, FEATURE);
  } catch {
    return null;
  }

  const { system, user } = buildSmartPricingAiPrompt(comp);
  try {
    const result = await generateStructured({
      feature: FEATURE,
      prompt: SMART_PRICING_PROMPT,
      system,
      user,
      temperature: 0.4,
      schema: SmartPricingAiResponse,
      jsonSchema: RESPONSE_SCHEMA,
      billing: { organizationId, propertyId, actorType: 'system', quotaChecked: true },
    });
    return {
      output: shapeSmartPricingAiOutput(
        result.data,
        comp.settings.minPrice != null,
        comp.settings.maxPrice != null,
        comp.base
      ),
      creditsConsumed: result.creditsConsumed,
    };
  } catch (err) {
    console.warn('[smartPricingAi] AI pass failed:', (err as Error).message);
    return null;
  }
}
