/**
 * Reservation + concurrency gate for Marketing Studio AI generation.
 *
 * `assertOrgAndPropertyAiQuota` is assert-then-charge, which is fine for a text
 * caption and fine for an image (5-15s between the assert and the charge, worst-case
 * overdraft one image). It is not fine for video: a host could fire twenty 800-credit
 * jobs in ten seconds and overdraw by 16,000 credits before the first one bills.
 *
 * Rather than add a hold table with a compensating release on every failure path
 * (including the sweeper's expire and reclaim passes), the job table IS the hold
 * ledger: anything in ('pending','processing','finalizing') counts as reserved via
 * its estimated_credits. The residual race — two simultaneous POSTs reading the same
 * in-flight sum — is bounded by the concurrency cap at one extra job, i.e. <=800
 * credits of overdraft worst case. That is a deliberate trade, not an oversight.
 *
 * Order of enforcement (after assertOrgAndPropertyAiQuota has already run):
 *   1. concurrency cap      → retryable 429, NOT an upgrade prompt
 *   2. in-flight reservation → AiQuotaExceededError (429 + upgradeHook)
 *   3. per-feature sub-cap   → AiQuotaExceededError, stops a media spree from
 *                              starving Inbox auto-reply for the rest of the month
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

import type { AiFeature } from './aiModelRouter.ts';
import { getOrgCreditWalletBalance } from './aiCreditLedger.ts';
import {
  AiQuotaExceededError,
  getAiPlatformOrgSettings,
  sumMonthCreditsConsumed,
} from './aiUsageService.ts';
import {
  MARKETING_IMAGE_GENERATE_FEATURE,
  MARKETING_VIDEO_GENERATE_FEATURE,
  monthlyCreditCapForFeature,
  parseMarketingGenerationOverrides,
} from './marketingGenerationFeatureConfig.ts';

export const MAX_CONCURRENT_PER_PROPERTY = 2;
export const MAX_CONCURRENT_PER_ORG = 5;

/** Share of an org's monthly credit allowance any one media feature may consume. */
export const DEFAULT_FEATURE_CREDIT_CAP_RATIO = 0.6;

const IN_FLIGHT_STATUSES = ['pending', 'processing', 'finalizing'];

export class GenerationConcurrencyError extends Error {
  readonly code = 'GENERATION_CONCURRENCY';
  readonly retryable = true;

  constructor(message: string) {
    super(message);
    this.name = 'GenerationConcurrencyError';
  }
}

export function isGenerationConcurrencyError(error: unknown): error is GenerationConcurrencyError {
  return error instanceof GenerationConcurrencyError;
}

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

function monthStartUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

type InFlight = { orgCount: number; propertyCount: number; reservedCredits: number };

async function readInFlight(organizationId: string, propertyId: string): Promise<InFlight> {
  const sb = db();
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .select('property_id, estimated_credits')
    .eq('organization_id', organizationId)
    .in('job_status', IN_FLIGHT_STATUSES);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return {
    orgCount: rows.length,
    propertyCount: rows.filter((row) => row.property_id === propertyId).length,
    reservedCredits: rows.reduce((sum, row) => sum + Number(row.estimated_credits ?? 0), 0),
  };
}

async function readMonthCreditsForFeature(
  organizationId: string,
  feature: AiFeature
): Promise<number> {
  const sb = db();
  // PostgREST aggregates (`credits_consumed.sum()`) are off by default
  // (`db-aggregates-enabled`) on local and hosted Supabase — they return
  // "Use of aggregate functions is not allowed". Match aiUsageService's
  // sumMonthCreditsConsumed: fetch the column and reduce in JS. Paginate past
  // `max_rows` so a busy org cannot undercount the feature sub-cap.
  const since = monthStartUtcIso();
  const pageSize = 1000;
  let total = 0;
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from('ai_platform_usage_events')
      .select('credits_consumed')
      .eq('organization_id', organizationId)
      .eq('feature', feature)
      .gte('created_at', since)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    total += rows.reduce((sum, row) => sum + Number(row.credits_consumed ?? 0), 0);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return total;
}

/** Super-admin / host per-property override: feature_configs[feature].monthly_credit_cap. */
async function readFeatureCreditCap(
  propertyId: string,
  feature: AiFeature,
  monthlyAllowance: number
): Promise<number> {
  const fallback = Math.floor(monthlyAllowance * DEFAULT_FEATURE_CREDIT_CAP_RATIO);
  try {
    const sb = db();
    const { data } = await sb
      .from('ai_platform_property_settings')
      .select('feature_configs')
      .eq('property_id', propertyId)
      .maybeSingle();
    const overrides = parseMarketingGenerationOverrides(data?.feature_configs);
    const mediaFeature =
      feature === 'marketing_video_generate'
        ? MARKETING_VIDEO_GENERATE_FEATURE
        : MARKETING_IMAGE_GENERATE_FEATURE;
    const cap = monthlyCreditCapForFeature(overrides, mediaFeature);
    if (cap != null) return cap;
  } catch (err) {
    console.warn(
      '[marketingGenerationBudget] feature cap lookup failed, using default:',
      (err as Error).message
    );
  }
  return fallback;
}

export type MarketingGenerationBudgetInput = {
  organizationId: string;
  propertyId: string;
  feature: AiFeature;
  estimatedCredits: number;
};

export async function assertMarketingGenerationBudget(
  input: MarketingGenerationBudgetInput
): Promise<void> {
  // Every read below is independent of every other — batch into one round trip instead
  // of five sequential ones. Only readFeatureCreditCap needs a result from this stage
  // (monthlyAllowance), so it runs after. sumMonthCreditsConsumed is the same "org
  // credits consumed this month" aiUsageService.ts's own quota gate already computes —
  // reused rather than re-derived, so the two never drift.
  const [inFlight, orgSettings, monthFeatureCredits, walletBalance, monthConsumed] =
    await Promise.all([
      readInFlight(input.organizationId, input.propertyId),
      getAiPlatformOrgSettings(input.organizationId),
      readMonthCreditsForFeature(input.organizationId, input.feature),
      getOrgCreditWalletBalance(input.organizationId).catch(() => 0),
      sumMonthCreditsConsumed(input.organizationId),
    ]);

  if (inFlight.propertyCount >= MAX_CONCURRENT_PER_PROPERTY) {
    throw new GenerationConcurrencyError(
      `Only ${MAX_CONCURRENT_PER_PROPERTY} generations can run at once for this property. Wait for one to finish.`
    );
  }
  if (inFlight.orgCount >= MAX_CONCURRENT_PER_ORG) {
    throw new GenerationConcurrencyError(
      `Only ${MAX_CONCURRENT_PER_ORG} generations can run at once across your properties. Wait for one to finish.`
    );
  }

  const monthlyAllowance = orgSettings.monthlyCreditLimit;

  // 2. Reservation — month-to-date spend plus everything already in flight plus this job
  //    must fit inside the allowance and any purchased top-up.
  const projected = monthConsumed + inFlight.reservedCredits + input.estimatedCredits;
  if (projected > monthlyAllowance + walletBalance) {
    throw new AiQuotaExceededError(
      'This would use more AI credits than your plan has left this month. Top up credits or upgrade to continue.'
    );
  }

  // 3. Per-feature sub-cap.
  const featureCap = await readFeatureCreditCap(input.propertyId, input.feature, monthlyAllowance);
  if (monthFeatureCredits + input.estimatedCredits > featureCap + walletBalance) {
    throw new AiQuotaExceededError(
      'Monthly limit for AI media generation reached. Top up credits or upgrade to continue.'
    );
  }
}
