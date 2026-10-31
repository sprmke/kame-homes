import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { supabase } from '@/lib/supabase/client';

export type SmartPricingMode = 'review_only' | 'autopilot';
export type SmartPricingBaseSource = 'property_rates' | 'custom';
export type SmartAggressiveness = 'conservative' | 'balanced' | 'aggressive';
export type SmartRounding = 'r50' | 'r99' | 'r100' | 'none';

export type SmartSeasonRule = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  percentage: number;
};

export type SmartLeadTimeTier = { days: number; pct: number };
export type SmartLeadTimeConfig = {
  lastMinute: SmartLeadTimeTier[];
  farOut: SmartLeadTimeTier[];
};

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

export type SmartPricingSettingsResponse = {
  settings: SmartPricingSettings;
  /** Applied recommendations still live from today forward — drives the "applied / Undo" UI. */
  appliedCount: number;
  resolvedBase: { weekday: number; weekend: number };
  history: {
    confidence: 'high' | 'low';
    forwardOccupancy: { d30: number; d60: number; d90: number };
    medianRealisedNightly: number | null;
  } | null;
};

export type SmartRateFactor = { key: string; label: string; multiplier: number };

export type SmartPricingDiffRow = {
  date: string;
  weekday: number;
  baseRate: number;
  recommendedRate: number;
  deltaPct: number;
  clampedBy: 'min' | 'max' | null;
  factors: SmartRateFactor[];
};

export type SmartPricingAiOutput = {
  seasonRationales: Array<{ label: string; text: string }>;
  warnings: string[];
  suggestedMinPrice: number | null;
  suggestedMaxPrice: number | null;
};

export type SmartPricingPreview = {
  runId: string;
  windowStart: string;
  windowEnd: string;
  base: { weekday: number; weekend: number };
  summary: { nightsComputed: number; nightsChanged: number; avgDeltaPct: number };
  /** Next 30 eligible nights in ₱ — the plain-language headline. */
  next30: { nights: number; currentTotal: number; smartTotal: number };
  historyConfidence: 'high' | 'low';
  skippedCount: number;
  diff: SmartPricingDiffRow[];
  ai: SmartPricingAiOutput | null;
};

/** Host-facing labels for the 3 engine `aggressiveness` levels. `range` mirrors the engine's
 *  per-night algorithmic deviation cap (`ALGO_DEVIATION_CAP`) so the card states the real limit. */
export const STRATEGY_OPTIONS: Array<{
  value: SmartAggressiveness;
  label: string;
  range: string;
}> = [
  { value: 'conservative', label: 'Gentle', range: '±6%' },
  { value: 'balanced', label: 'Balanced', range: '±12%' },
  { value: 'aggressive', label: 'Bold', range: '±22%' },
];

export type SmartPricingSettingsPatch = Partial<Omit<SmartPricingSettings, 'lastRunAt'>>;

export const SMART_PRICING_QUERY_KEY = 'smart-pricing';

export type SmartPricingClientError = Error & {
  upgradeRequired?: boolean;
  feature?: PlanFeatureKey;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (json?.upgradeHook) {
    const err = new Error(json?.error ?? 'Upgrade required') as SmartPricingClientError;
    err.upgradeRequired = true;
    if (typeof json?.feature === 'string') err.feature = json.feature as PlanFeatureKey;
    throw err;
  }
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error ?? json?.message ?? 'Request failed');
  }
  return (json.data ?? json) as T;
}

export async function fetchSmartPricingSettings(
  propertyId: string
): Promise<SmartPricingSettingsResponse> {
  const res = await fetch(scopedFunctionsUrl('/smart-pricing-settings', propertyId), {
    headers: await authHeaders(),
  });
  return parse<SmartPricingSettingsResponse>(res);
}

export async function saveSmartPricingSettings(
  propertyId: string,
  patch: SmartPricingSettingsPatch
): Promise<{ settings: SmartPricingSettings }> {
  const res = await fetch(scopedFunctionsUrl('/smart-pricing-settings', propertyId), {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  return parse<{ settings: SmartPricingSettings }>(res);
}

export async function previewSmartPricing(
  propertyId: string,
  opts?: { explain?: boolean }
): Promise<SmartPricingPreview> {
  const res = await fetch(scopedFunctionsUrl('/smart-pricing-preview', propertyId), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ explain: opts?.explain ?? true }),
  });
  return parse<SmartPricingPreview>(res);
}

export async function applySmartPricing(
  propertyId: string,
  input: { runId: string; ranges?: Array<{ start: string; end: string }> }
): Promise<{ applied: number; skippedUnavailable: number }> {
  const res = await fetch(scopedFunctionsUrl('/smart-pricing-apply', propertyId), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  return parse<{ applied: number; skippedUnavailable: number }>(res);
}

export async function clearSmartPricing(propertyId: string): Promise<{ cleared: true }> {
  const res = await fetch(scopedFunctionsUrl('/smart-pricing-apply', propertyId), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ clear: true }),
  });
  return parse<{ cleared: true }>(res);
}
