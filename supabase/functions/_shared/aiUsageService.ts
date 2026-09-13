/**
 * Platform AI usage metering, org/property quotas, feature gating, and cost estimation.
 *
 * All AI calls must flow through this service so that:
 * 1. The global kill switch and per-feature allowlist are checked first.
 * 2. Org and property daily/monthly call limits and cost caps are enforced.
 * 3. Usage is recorded at org and property level.
 * 4. Deterministic responses can be cached and reused.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

import {
  estimateTokenCostUsd,
  getModelConfig,
  isValidAiFeature,
  type AiFeature,
} from './aiModelRouter.ts';
import {
  adjustOrgCreditWallet,
  estimateCreditsFromCostUsd,
  getOrgCreditWalletBalance,
} from './aiCreditLedger.ts';

export class AiQuotaExceededError extends Error {
  readonly code = 'AI_QUOTA_EXCEEDED';
  readonly upgradeHook = true;

  constructor(message = 'AI usage limit reached for this organization') {
    super(message);
    this.name = 'AiQuotaExceededError';
  }
}

export class AiPlatformDisabledError extends Error {
  readonly code = 'AI_PLATFORM_DISABLED';

  constructor(message = 'AI features are temporarily unavailable') {
    super(message);
    this.name = 'AiPlatformDisabledError';
  }
}

export class AiFeatureDisabledError extends Error {
  readonly code = 'AI_FEATURE_DISABLED';

  constructor(feature: AiFeature) {
    super(`AI feature "${feature}" is currently disabled`);
    this.name = 'AiFeatureDisabledError';
  }
}

const DEFAULT_DAILY_LIMIT = 200;
const DEFAULT_MONTHLY_LIMIT = 5000;
const DEFAULT_DAILY_COST_USD_LIMIT = 10;
const DEFAULT_CREDIT_UNIT_USD = 0.001;
const DEFAULT_VOICE_RECEPTIONIST_COST_PER_MINUTE_USD = 0.023;
/** Deliberately generous working defaults — see migration 20261022150000 header comment. */
const DEFAULT_DAILY_CREDIT_LIMIT = 100000;
const DEFAULT_MONTHLY_CREDIT_LIMIT = 1000000;
/** Platform-wide daily USD ceiling (cost-abuse / AI plan Phase 2). 0 = disabled. */
const DEFAULT_PLATFORM_DAILY_COST_USD_CAP = 150;

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartUtcDate(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function platformDailyCostUsdCap(): number {
  const raw = Deno.env.get('AI_PLATFORM_DAILY_COST_USD_CAP')?.trim();
  if (!raw) return DEFAULT_PLATFORM_DAILY_COST_USD_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PLATFORM_DAILY_COST_USD_CAP;
}

async function sumPlatformDailyCostUsd(): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_usage_daily')
    .select('estimated_cost_usd')
    .eq('usage_date', todayUtcDate());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
}

export type AiPlatformGlobalSettings = {
  enabled: boolean;
  enforceQuotas: boolean;
  allowedFeatures: AiFeature[];
  defaultDailyCallLimit: number;
  defaultMonthlyCallLimit: number;
  defaultDailyCostUsdLimit: number;
  /** USD value of 1 credit — see aiCreditLedger.ts#estimateCreditsFromCostUsd. */
  creditUnitUsd: number;
  /** Configurable per-minute cost estimate for voice_receptionist (cost_basis: 'duration'). */
  voiceReceptionistCostPerMinuteUsd: number;
  /** Working defaults, deliberately generous — see migration 20261022150000 header comment. */
  defaultDailyCreditLimit: number;
  defaultMonthlyCreditLimit: number;
  updatedAt: string | null;
};

export type AiPlatformOrgSettings = {
  organizationId: string;
  enabled: boolean;
  dailyCallLimit: number;
  monthlyCallLimit: number;
  dailyCostUsdLimit: number;
  dailyCreditLimit: number;
  monthlyCreditLimit: number;
  planTier: string;
  updatedAt: string | null;
};

export type AiPlatformPropertySettings = {
  propertyId: string;
  organizationId: string;
  enabled: boolean;
  dailyCallLimit: number | null;
  monthlyCallLimit: number | null;
  dailyCostUsdLimit: number | null;
  dailyCreditLimit: number | null;
  monthlyCreditLimit: number | null;
  updatedAt: string | null;
};

export type AiUsageSummary = {
  todayCallCount: number;
  monthCallCount: number;
  todayCostUsd: number;
  monthCostUsd: number;
  todayCreditsConsumed: number;
  monthCreditsConsumed: number;
  dailyCallLimit: number;
  monthlyCallLimit: number;
  dailyCostUsdLimit: number;
  dailyCreditLimit: number;
  monthlyCreditLimit: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  dailyCostRemaining: number;
  planTier: string;
  quotaExceeded: boolean;
};

export type AiActorType = 'staff' | 'guest' | 'system';

export type RecordAiUsageInput = {
  organizationId: string;
  propertyId?: string | null;
  feature: AiFeature;
  provider: 'gemini' | 'groq';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  /** Set when this usage is a cache hit; still counted as 1 call but at zero cost. */
  cacheHit?: boolean;
  /** Who triggered this call, when known — attribution only, not an enforcement axis. */
  actorUserId?: string | null;
  actorType?: AiActorType;
  /** voice_receptionist only — duration-based cost basis instead of token estimate. */
  durationSeconds?: number;
};

export async function getAiPlatformGlobalSettings(): Promise<AiPlatformGlobalSettings> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_global_settings')
    .select(
      'enabled, enforce_quotas, allowed_features, default_daily_call_limit, default_monthly_call_limit, default_daily_cost_usd_limit, credit_unit_usd, voice_receptionist_cost_per_minute_usd, default_daily_credit_limit, default_monthly_credit_limit, updated_at'
    )
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const allowedFeatures = normalizeAllowedFeatures(data?.allowed_features as string[] | null);

  return {
    enabled: data?.enabled !== false,
    enforceQuotas: data?.enforce_quotas !== false,
    allowedFeatures,
    defaultDailyCallLimit: Number(data?.default_daily_call_limit ?? DEFAULT_DAILY_LIMIT),
    defaultMonthlyCallLimit: Number(data?.default_monthly_call_limit ?? DEFAULT_MONTHLY_LIMIT),
    defaultDailyCostUsdLimit: Number(
      data?.default_daily_cost_usd_limit ?? DEFAULT_DAILY_COST_USD_LIMIT
    ),
    creditUnitUsd: Number(data?.credit_unit_usd ?? DEFAULT_CREDIT_UNIT_USD),
    voiceReceptionistCostPerMinuteUsd: Number(
      data?.voice_receptionist_cost_per_minute_usd ?? DEFAULT_VOICE_RECEPTIONIST_COST_PER_MINUTE_USD
    ),
    defaultDailyCreditLimit: Number(data?.default_daily_credit_limit ?? DEFAULT_DAILY_CREDIT_LIMIT),
    defaultMonthlyCreditLimit: Number(
      data?.default_monthly_credit_limit ?? DEFAULT_MONTHLY_CREDIT_LIMIT
    ),
    updatedAt: (data?.updated_at as string | null) ?? null,
  };
}

function normalizeAllowedFeatures(raw: unknown): AiFeature[] {
  if (!Array.isArray(raw)) return [];
  const features: AiFeature[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && isValidAiFeature(item)) {
      features.push(item);
    }
  }
  return features;
}

export async function setAiPlatformGlobalSettings(input: {
  enabled?: boolean;
  enforceQuotas?: boolean;
  allowedFeatures?: AiFeature[];
  defaultDailyCallLimit?: number;
  defaultMonthlyCallLimit?: number;
  defaultDailyCostUsdLimit?: number;
  creditUnitUsd?: number;
  voiceReceptionistCostPerMinuteUsd?: number;
  defaultDailyCreditLimit?: number;
  defaultMonthlyCreditLimit?: number;
  updatedBy: string;
}): Promise<AiPlatformGlobalSettings> {
  const sb = db();
  const patch: Record<string, unknown> = { updated_by: input.updatedBy };
  if (typeof input.enabled === 'boolean') patch.enabled = input.enabled;
  if (typeof input.enforceQuotas === 'boolean') patch.enforce_quotas = input.enforceQuotas;
  if (Array.isArray(input.allowedFeatures)) {
    patch.allowed_features = input.allowedFeatures.filter((feature) => isValidAiFeature(feature));
  }
  if (typeof input.defaultDailyCallLimit === 'number')
    patch.default_daily_call_limit = input.defaultDailyCallLimit;
  if (typeof input.defaultMonthlyCallLimit === 'number')
    patch.default_monthly_call_limit = input.defaultMonthlyCallLimit;
  if (typeof input.defaultDailyCostUsdLimit === 'number')
    patch.default_daily_cost_usd_limit = input.defaultDailyCostUsdLimit;
  if (typeof input.creditUnitUsd === 'number') patch.credit_unit_usd = input.creditUnitUsd;
  if (typeof input.voiceReceptionistCostPerMinuteUsd === 'number')
    patch.voice_receptionist_cost_per_minute_usd = input.voiceReceptionistCostPerMinuteUsd;
  if (typeof input.defaultDailyCreditLimit === 'number')
    patch.default_daily_credit_limit = input.defaultDailyCreditLimit;
  if (typeof input.defaultMonthlyCreditLimit === 'number')
    patch.default_monthly_credit_limit = input.defaultMonthlyCreditLimit;

  const { data, error } = await sb
    .from('ai_platform_global_settings')
    .update(patch)
    .eq('id', 1)
    .select(
      'enabled, enforce_quotas, allowed_features, default_daily_call_limit, default_monthly_call_limit, default_daily_cost_usd_limit, credit_unit_usd, voice_receptionist_cost_per_minute_usd, default_daily_credit_limit, default_monthly_credit_limit, updated_at'
    )
    .maybeSingle();
  if (error) throw new Error(error.message);

  return {
    enabled: data?.enabled !== false,
    enforceQuotas: data?.enforce_quotas !== false,
    allowedFeatures: normalizeAllowedFeatures(data?.allowed_features as string[] | null),
    defaultDailyCallLimit: Number(data?.default_daily_call_limit ?? DEFAULT_DAILY_LIMIT),
    defaultMonthlyCallLimit: Number(data?.default_monthly_call_limit ?? DEFAULT_MONTHLY_LIMIT),
    defaultDailyCostUsdLimit: Number(
      data?.default_daily_cost_usd_limit ?? DEFAULT_DAILY_COST_USD_LIMIT
    ),
    creditUnitUsd: Number(data?.credit_unit_usd ?? DEFAULT_CREDIT_UNIT_USD),
    voiceReceptionistCostPerMinuteUsd: Number(
      data?.voice_receptionist_cost_per_minute_usd ?? DEFAULT_VOICE_RECEPTIONIST_COST_PER_MINUTE_USD
    ),
    defaultDailyCreditLimit: Number(data?.default_daily_credit_limit ?? DEFAULT_DAILY_CREDIT_LIMIT),
    defaultMonthlyCreditLimit: Number(
      data?.default_monthly_credit_limit ?? DEFAULT_MONTHLY_CREDIT_LIMIT
    ),
    updatedAt: (data?.updated_at as string | null) ?? null,
  };
}

export async function isFeatureEnabled(feature: AiFeature): Promise<boolean> {
  const global = await getAiPlatformGlobalSettings();
  if (!global.enabled) return false;
  if (global.allowedFeatures.length === 0) return true;
  return global.allowedFeatures.includes(feature);
}

export async function getAiPlatformOrgSettings(
  organizationId: string
): Promise<AiPlatformOrgSettings> {
  const global = await getAiPlatformGlobalSettings();
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_org_settings')
    .select(
      'organization_id, enabled, daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, plan_tier, updated_at'
    )
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return {
    organizationId,
    enabled: data?.enabled !== false,
    dailyCallLimit: Number(data?.daily_call_limit ?? global.defaultDailyCallLimit),
    monthlyCallLimit: Number(data?.monthly_call_limit ?? global.defaultMonthlyCallLimit),
    dailyCostUsdLimit: Number(data?.daily_cost_usd_limit ?? global.defaultDailyCostUsdLimit),
    dailyCreditLimit: Number(data?.daily_credit_limit ?? global.defaultDailyCreditLimit),
    monthlyCreditLimit: Number(data?.monthly_credit_limit ?? global.defaultMonthlyCreditLimit),
    planTier: String(data?.plan_tier ?? 'included'),
    updatedAt: (data?.updated_at as string | null) ?? null,
  };
}

export async function upsertAiPlatformOrgSettings(input: {
  organizationId: string;
  enabled?: boolean;
  dailyCallLimit?: number;
  monthlyCallLimit?: number;
  dailyCostUsdLimit?: number;
  dailyCreditLimit?: number;
  monthlyCreditLimit?: number;
  planTier?: string;
  updatedBy: string;
}): Promise<AiPlatformOrgSettings> {
  const sb = db();
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    updated_by: input.updatedBy,
  };
  if (typeof input.enabled === 'boolean') row.enabled = input.enabled;
  if (typeof input.dailyCallLimit === 'number') row.daily_call_limit = input.dailyCallLimit;
  if (typeof input.monthlyCallLimit === 'number') row.monthly_call_limit = input.monthlyCallLimit;
  if (typeof input.dailyCostUsdLimit === 'number')
    row.daily_cost_usd_limit = input.dailyCostUsdLimit;
  if (typeof input.dailyCreditLimit === 'number') row.daily_credit_limit = input.dailyCreditLimit;
  if (typeof input.monthlyCreditLimit === 'number')
    row.monthly_credit_limit = input.monthlyCreditLimit;
  if (typeof input.planTier === 'string' && input.planTier.trim())
    row.plan_tier = input.planTier.trim();

  const { error } = await sb.from('ai_platform_org_settings').upsert(row, {
    onConflict: 'organization_id',
  });
  if (error) throw new Error(error.message);
  return getAiPlatformOrgSettings(input.organizationId);
}

export async function ensureAiPlatformPropertySettingsRow(
  propertyId: string,
  organizationId: string
): Promise<void> {
  const sb = db();
  await sb
    .from('ai_platform_property_settings')
    .upsert(
      { property_id: propertyId, organization_id: organizationId },
      { onConflict: 'property_id', ignoreDuplicates: true }
    );
}

export async function getAiPlatformPropertySettings(
  propertyId: string,
  organizationId: string
): Promise<AiPlatformPropertySettings> {
  await ensureAiPlatformPropertySettingsRow(propertyId, organizationId);
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_property_settings')
    .select(
      'property_id, organization_id, enabled, daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, updated_at'
    )
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      propertyId,
      organizationId,
      enabled: true,
      dailyCallLimit: null,
      monthlyCallLimit: null,
      dailyCostUsdLimit: null,
      dailyCreditLimit: null,
      monthlyCreditLimit: null,
      updatedAt: null,
    };
  }
  return {
    propertyId: data.property_id as string,
    organizationId: data.organization_id as string,
    enabled: data.enabled !== false,
    dailyCallLimit: data.daily_call_limit == null ? null : Number(data.daily_call_limit),
    monthlyCallLimit: data.monthly_call_limit == null ? null : Number(data.monthly_call_limit),
    dailyCostUsdLimit: data.daily_cost_usd_limit == null ? null : Number(data.daily_cost_usd_limit),
    dailyCreditLimit: data.daily_credit_limit == null ? null : Number(data.daily_credit_limit),
    monthlyCreditLimit:
      data.monthly_credit_limit == null ? null : Number(data.monthly_credit_limit),
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}

export async function upsertAiPlatformPropertySettings(input: {
  propertyId: string;
  organizationId: string;
  enabled?: boolean;
  dailyCallLimit?: number | null;
  monthlyCallLimit?: number | null;
  dailyCostUsdLimit?: number | null;
  dailyCreditLimit?: number | null;
  monthlyCreditLimit?: number | null;
  updatedBy: string;
}): Promise<AiPlatformPropertySettings> {
  const sb = db();
  await ensureAiPlatformPropertySettingsRow(input.propertyId, input.organizationId);
  const patch: Record<string, unknown> = {
    organization_id: input.organizationId,
    updated_by: input.updatedBy,
  };
  if (typeof input.enabled === 'boolean') patch.enabled = input.enabled;
  if (input.dailyCallLimit !== undefined) patch.daily_call_limit = input.dailyCallLimit;
  if (input.monthlyCallLimit !== undefined) patch.monthly_call_limit = input.monthlyCallLimit;
  if (input.dailyCostUsdLimit !== undefined) patch.daily_cost_usd_limit = input.dailyCostUsdLimit;
  if (input.dailyCreditLimit !== undefined) patch.daily_credit_limit = input.dailyCreditLimit;
  if (input.monthlyCreditLimit !== undefined) patch.monthly_credit_limit = input.monthlyCreditLimit;

  const { data, error } = await sb
    .from('ai_platform_property_settings')
    .update(patch)
    .eq('property_id', input.propertyId)
    .select(
      'property_id, organization_id, enabled, daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, updated_at'
    )
    .single();
  if (error) throw new Error(error.message);

  return {
    propertyId: data.property_id as string,
    organizationId: data.organization_id as string,
    enabled: data.enabled !== false,
    dailyCallLimit: data.daily_call_limit == null ? null : Number(data.daily_call_limit),
    monthlyCallLimit: data.monthly_call_limit == null ? null : Number(data.monthly_call_limit),
    dailyCostUsdLimit: data.daily_cost_usd_limit == null ? null : Number(data.daily_cost_usd_limit),
    dailyCreditLimit: data.daily_credit_limit == null ? null : Number(data.daily_credit_limit),
    monthlyCreditLimit:
      data.monthly_credit_limit == null ? null : Number(data.monthly_credit_limit),
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}

export async function resolveOrgIdForProperty(propertyId: string): Promise<string | null> {
  const sb = db();
  const { data, error } = await sb
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) {
    console.error('[aiUsageService] resolveOrgIdForProperty:', error.message);
    return null;
  }
  return (data?.organization_id as string | null) ?? null;
}

async function sumMonthCallCount(organizationId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_usage_daily')
    .select('call_count')
    .eq('organization_id', organizationId)
    .gte('usage_date', monthStartUtcDate());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.call_count ?? 0), 0);
}

async function sumMonthCostUsd(organizationId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_usage_daily')
    .select('estimated_cost_usd')
    .eq('organization_id', organizationId)
    .gte('usage_date', monthStartUtcDate());
  if (error) throw new Error(error.message);
  const total = (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  return Math.round(total * 1_000_000) / 1_000_000;
}

/** Exported for marketingGenerationBudget.ts — the two must never independently re-derive
 *  "org credits consumed this month" (that's exactly the kind of drift a shared quota
 *  system exists to prevent). */
export async function sumMonthCreditsConsumed(organizationId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_usage_daily')
    .select('credits_consumed')
    .eq('organization_id', organizationId)
    .gte('usage_date', monthStartUtcDate());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.credits_consumed ?? 0), 0);
}

async function sumPropertyMonthCreditsConsumed(propertyId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_property_usage_daily')
    .select('credits_consumed')
    .eq('property_id', propertyId)
    .gte('usage_date', monthStartUtcDate());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.credits_consumed ?? 0), 0);
}

async function sumPropertyMonthCallCount(propertyId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_property_usage_daily')
    .select('call_count')
    .eq('property_id', propertyId)
    .gte('usage_date', monthStartUtcDate());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.call_count ?? 0), 0);
}

async function sumPropertyMonthCostUsd(propertyId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_property_usage_daily')
    .select('estimated_cost_usd')
    .eq('property_id', propertyId)
    .gte('usage_date', monthStartUtcDate());
  if (error) throw new Error(error.message);
  const total = (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  return Math.round(total * 1_000_000) / 1_000_000;
}

export async function getOrgAiUsageSummary(organizationId: string): Promise<AiUsageSummary> {
  const orgSettings = await getAiPlatformOrgSettings(organizationId);
  const sb = db();
  const today = todayUtcDate();

  const { data: todayRow, error: todayError } = await sb
    .from('ai_platform_usage_daily')
    .select('call_count, estimated_cost_usd, credits_consumed')
    .eq('organization_id', organizationId)
    .eq('usage_date', today)
    .maybeSingle();
  if (todayError) throw new Error(todayError.message);

  const todayCallCount = Number(todayRow?.call_count ?? 0);
  const todayCostUsd = Number(todayRow?.estimated_cost_usd ?? 0);
  const todayCreditsConsumed = Number(todayRow?.credits_consumed ?? 0);
  const monthCallCount = await sumMonthCallCount(organizationId);
  const monthCostUsd = await sumMonthCostUsd(organizationId);
  const monthCreditsConsumed = await sumMonthCreditsConsumed(organizationId);

  const dailyRemaining = Math.max(0, orgSettings.dailyCallLimit - todayCallCount);
  const monthlyRemaining = Math.max(0, orgSettings.monthlyCallLimit - monthCallCount);
  const dailyCostRemaining = Math.max(0, orgSettings.dailyCostUsdLimit - todayCostUsd);

  return {
    todayCallCount,
    monthCallCount,
    todayCostUsd,
    monthCostUsd,
    todayCreditsConsumed,
    monthCreditsConsumed,
    dailyCallLimit: orgSettings.dailyCallLimit,
    monthlyCallLimit: orgSettings.monthlyCallLimit,
    dailyCostUsdLimit: orgSettings.dailyCostUsdLimit,
    dailyCreditLimit: orgSettings.dailyCreditLimit,
    monthlyCreditLimit: orgSettings.monthlyCreditLimit,
    dailyRemaining,
    monthlyRemaining,
    dailyCostRemaining,
    planTier: orgSettings.planTier,
    quotaExceeded: dailyRemaining <= 0 || monthlyRemaining <= 0 || dailyCostRemaining <= 0,
  };
}

export async function getOrgAiUsageBreakdown(organizationId: string): Promise<{
  today: Array<{ feature: string; calls: number; estimatedCostUsd: number }>;
  month: Array<{ feature: string; calls: number; estimatedCostUsd: number }>;
}> {
  const sb = db();
  const today = todayUtcDate();
  const monthStart = monthStartUtcDate();

  const { data: todayRows, error: todayError } = await sb
    .from('ai_platform_usage_events')
    .select('feature, calls:count(*), estimatedCostUsd:estimated_cost_usd.sum()')
    .eq('organization_id', organizationId)
    .gte('created_at', today + 'T00:00:00Z')
    .group('feature');
  if (todayError) throw new Error(todayError.message);

  const { data: monthRows, error: monthError } = await sb
    .from('ai_platform_usage_events')
    .select('feature, calls:count(*), estimatedCostUsd:estimated_cost_usd.sum()')
    .eq('organization_id', organizationId)
    .gte('created_at', monthStart + 'T00:00:00Z')
    .group('feature');
  if (monthError) throw new Error(monthError.message);

  return {
    today: (todayRows ?? []).map((row) => ({
      feature: String(row.feature),
      calls: Number((row as { calls?: number }).calls ?? 0),
      estimatedCostUsd: Number((row as { estimatedCostUsd?: number }).estimatedCostUsd ?? 0),
    })),
    month: (monthRows ?? []).map((row) => ({
      feature: String(row.feature),
      calls: Number((row as { calls?: number }).calls ?? 0),
      estimatedCostUsd: Number((row as { estimatedCostUsd?: number }).estimatedCostUsd ?? 0),
    })),
  };
}

export async function getOrgAiPropertyUsageBreakdown(organizationId: string): Promise<
  Array<{
    propertyId: string;
    todayCallCount: number;
    todayCostUsd: number;
    monthCallCount: number;
    monthCostUsd: number;
  }>
> {
  const sb = db();
  const today = todayUtcDate();
  const monthStart = monthStartUtcDate();

  const { data: todayRows, error: todayError } = await sb
    .from('ai_platform_property_usage_daily')
    .select('property_id, call_count, estimated_cost_usd')
    .eq('organization_id', organizationId)
    .eq('usage_date', today);
  if (todayError) throw new Error(todayError.message);

  const { data: monthRows, error: monthError } = await sb
    .from('ai_platform_property_usage_daily')
    .select('property_id, call_count, estimated_cost_usd')
    .eq('organization_id', organizationId)
    .gte('usage_date', monthStart);
  if (monthError) throw new Error(monthError.message);

  const monthByProperty = new Map<
    string,
    { propertyId: string; callCount: number; costUsd: number }
  >();
  for (const row of monthRows ?? []) {
    const id = row.property_id as string;
    const entry = monthByProperty.get(id) ?? { propertyId: id, callCount: 0, costUsd: 0 };
    entry.callCount += Number(row.call_count ?? 0);
    entry.costUsd += Number(row.estimated_cost_usd ?? 0);
    monthByProperty.set(id, entry);
  }

  const todayByProperty = new Map<string, { callCount: number; costUsd: number }>();
  for (const row of todayRows ?? []) {
    const id = row.property_id as string;
    const entry = todayByProperty.get(id) ?? { callCount: 0, costUsd: 0 };
    entry.callCount += Number(row.call_count ?? 0);
    entry.costUsd += Number(row.estimated_cost_usd ?? 0);
    todayByProperty.set(id, entry);
  }

  const properties = Array.from(new Set([...monthByProperty.keys(), ...todayByProperty.keys()]));
  return properties.map((propertyId) => ({
    propertyId,
    todayCallCount: todayByProperty.get(propertyId)?.callCount ?? 0,
    todayCostUsd: todayByProperty.get(propertyId)?.costUsd ?? 0,
    monthCallCount: monthByProperty.get(propertyId)?.callCount ?? 0,
    monthCostUsd: monthByProperty.get(propertyId)?.costUsd ?? 0,
  }));
}

export async function getPropertyAiUsageSummary(
  propertyId: string,
  organizationId?: string
): Promise<AiUsageSummary> {
  const resolvedOrgId = organizationId ?? (await resolveOrgIdForProperty(propertyId));
  if (!resolvedOrgId) throw new Error(`Could not resolve organization for property ${propertyId}`);

  const orgSettings = await getAiPlatformOrgSettings(resolvedOrgId);
  const propertySettings = await getAiPlatformPropertySettings(propertyId, resolvedOrgId);

  const sb = db();
  const today = todayUtcDate();

  const { data: todayRow, error: todayError } = await sb
    .from('ai_platform_property_usage_daily')
    .select('call_count, estimated_cost_usd, credits_consumed')
    .eq('property_id', propertyId)
    .eq('usage_date', today)
    .maybeSingle();
  if (todayError) throw new Error(todayError.message);

  const todayCallCount = Number(todayRow?.call_count ?? 0);
  const todayCostUsd = Number(todayRow?.estimated_cost_usd ?? 0);
  const todayCreditsConsumed = Number(todayRow?.credits_consumed ?? 0);
  const monthCallCount = await sumPropertyMonthCallCount(propertyId);
  const monthCostUsd = await sumPropertyMonthCostUsd(propertyId);
  const monthCreditsConsumed = await sumPropertyMonthCreditsConsumed(propertyId);

  const dailyCallLimit = propertySettings.dailyCallLimit ?? orgSettings.dailyCallLimit;
  const monthlyCallLimit = propertySettings.monthlyCallLimit ?? orgSettings.monthlyCallLimit;
  const dailyCostUsdLimit = propertySettings.dailyCostUsdLimit ?? orgSettings.dailyCostUsdLimit;
  const dailyCreditLimit = propertySettings.dailyCreditLimit ?? orgSettings.dailyCreditLimit;
  const monthlyCreditLimit = propertySettings.monthlyCreditLimit ?? orgSettings.monthlyCreditLimit;

  const dailyRemaining = Math.max(0, dailyCallLimit - todayCallCount);
  const monthlyRemaining = Math.max(0, monthlyCallLimit - monthCallCount);
  const dailyCostRemaining = Math.max(0, dailyCostUsdLimit - todayCostUsd);

  return {
    todayCallCount,
    monthCallCount,
    todayCostUsd,
    monthCostUsd,
    todayCreditsConsumed,
    monthCreditsConsumed,
    dailyCallLimit,
    monthlyCallLimit,
    dailyCostUsdLimit,
    dailyCreditLimit,
    monthlyCreditLimit,
    dailyRemaining,
    monthlyRemaining,
    dailyCostRemaining,
    planTier: orgSettings.planTier,
    quotaExceeded: dailyRemaining <= 0 || monthlyRemaining <= 0 || dailyCostRemaining <= 0,
  };
}

type CreditAllowanceStatus = { exceeded: boolean; period?: 'daily' | 'monthly' };

/**
 * Shared by the enforcement gate (assertOrgAndPropertyAiQuota) and the wallet-debit decision
 * in recordAiUsage() — both must agree on exactly when an allowance counts as exceeded, or a
 * call admitted via the wallet at the gate can silently never get debited (see docs/workflow's
 * Phase 3 review notes).
 */
function creditAllowanceExceeded(
  usage: { todayCreditsConsumed: number; monthCreditsConsumed: number },
  limits: { dailyCreditLimit: number; monthlyCreditLimit: number }
): CreditAllowanceStatus {
  if (usage.todayCreditsConsumed >= limits.dailyCreditLimit) {
    return { exceeded: true, period: 'daily' };
  }
  if (usage.monthCreditsConsumed >= limits.monthlyCreditLimit) {
    return { exceeded: true, period: 'monthly' };
  }
  return { exceeded: false };
}

/** Fail closed when platform/org/property disabled or quota exceeded. */
export async function assertOrgAndPropertyAiQuota(
  organizationId: string,
  propertyId: string | null | undefined,
  feature: AiFeature
): Promise<void> {
  const global = await getAiPlatformGlobalSettings();
  if (!global.enabled) {
    throw new AiPlatformDisabledError();
  }
  if (global.allowedFeatures.length > 0 && !global.allowedFeatures.includes(feature)) {
    throw new AiFeatureDisabledError(feature);
  }

  const orgSettings = await getAiPlatformOrgSettings(organizationId);
  if (!orgSettings.enabled) {
    throw new AiPlatformDisabledError('AI is disabled for this organization');
  }

  if (!global.enforceQuotas) return;

  const platformCap = platformDailyCostUsdCap();
  if (platformCap > 0) {
    const platformCostToday = await sumPlatformDailyCostUsd();
    if (platformCostToday >= platformCap) {
      throw new AiQuotaExceededError('Platform daily AI spend limit reached');
    }
  }

  const orgSummary = await getOrgAiUsageSummary(organizationId);
  if (orgSummary.dailyRemaining <= 0) {
    throw new AiQuotaExceededError('Daily AI call limit reached for this organization');
  }
  if (orgSummary.monthlyRemaining <= 0) {
    throw new AiQuotaExceededError('Monthly AI call limit reached for this organization');
  }
  if (orgSummary.dailyCostRemaining <= 0) {
    throw new AiQuotaExceededError('Daily AI cost limit reached for this organization');
  }

  let propertySettings: AiPlatformPropertySettings | null = null;
  let propertySummary: AiUsageSummary | null = null;
  if (propertyId) {
    propertySettings = await getAiPlatformPropertySettings(propertyId, organizationId);
    if (!propertySettings.enabled) {
      throw new AiPlatformDisabledError('AI is disabled for this property');
    }
    propertySummary = await getPropertyAiUsageSummary(propertyId, organizationId);
    if (propertySummary.dailyRemaining <= 0) {
      throw new AiQuotaExceededError('Daily AI call limit reached for this property');
    }
    if (propertySummary.monthlyRemaining <= 0) {
      throw new AiQuotaExceededError('Monthly AI call limit reached for this property');
    }
    if (propertySummary.dailyCostRemaining <= 0) {
      throw new AiQuotaExceededError('Daily AI cost limit reached for this property');
    }
  }

  const orgCreditStatus = creditAllowanceExceeded(orgSummary, orgSettings);
  const propertyCreditStatus =
    propertySettings && propertySummary
      ? creditAllowanceExceeded(propertySummary, {
          dailyCreditLimit: propertySettings.dailyCreditLimit ?? orgSettings.dailyCreditLimit,
          monthlyCreditLimit: propertySettings.monthlyCreditLimit ?? orgSettings.monthlyCreditLimit,
        })
      : { exceeded: false as const, period: undefined };

  if (orgCreditStatus.exceeded || propertyCreditStatus.exceeded) {
    const walletBalance = await getOrgCreditWalletBalance(organizationId);
    if (walletBalance <= 0) {
      const scope = orgCreditStatus.exceeded ? 'organization' : 'property';
      const period = (orgCreditStatus.exceeded ? orgCreditStatus : propertyCreditStatus).period;
      throw new AiQuotaExceededError(
        `${period === 'daily' ? 'Daily' : 'Monthly'} AI credit allowance used for this ${scope} — top up credits to continue`
      );
    }
  }
}

/** Backward-compatible org-only quota check. */
export async function assertOrgAiQuota(organizationId: string): Promise<void> {
  await assertOrgAndPropertyAiQuota(organizationId, null, 'ai_integration_verify');
}

/** Skip quota when orgId is null (e.g. platform verify probe). */
export async function assertOrgAiQuotaOptional(
  organizationId: string | null | undefined,
  feature?: AiFeature
): Promise<void> {
  if (!organizationId) return;
  await assertOrgAndPropertyAiQuota(organizationId, null, feature ?? 'ai_integration_verify');
}

export async function assertPropertyAiQuotaOptional(
  organizationId: string | null | undefined,
  propertyId: string | null | undefined,
  feature?: AiFeature
): Promise<void> {
  if (!organizationId) return;
  await assertOrgAndPropertyAiQuota(
    organizationId,
    propertyId ?? null,
    feature ?? 'ai_integration_verify'
  );
}

export async function recordAiUsage(
  input: RecordAiUsageInput
): Promise<{ creditsConsumed: number; usageEventId: string | null }> {
  const config = getModelConfig(input.feature);
  const inputTokens = Math.max(0, input.inputTokens ?? 0);
  const outputTokens = Math.max(0, input.outputTokens ?? 0);
  const estimatedCostUsd = input.cacheHit
    ? 0
    : (input.estimatedCostUsd ?? estimateTokenCostUsd(config, inputTokens, outputTokens));

  // Best-effort like the rest of this function (see the RPC fallback and warn-only inserts
  // below) — a transient failure loading credit_unit_usd must never block recording (or the
  // caller's already-successful AI response) over telemetry, so this falls back to the
  // platform default instead of throwing.
  let creditUnitUsd = DEFAULT_CREDIT_UNIT_USD;
  try {
    creditUnitUsd = (await getAiPlatformGlobalSettings()).creditUnitUsd;
  } catch (err) {
    console.warn(
      '[aiUsageService] failed to load credit_unit_usd, using default:',
      (err as Error).message
    );
  }
  const creditsConsumed = estimateCreditsFromCostUsd(
    estimatedCostUsd,
    creditUnitUsd,
    Boolean(input.cacheHit)
  );
  const costBasis = typeof input.durationSeconds === 'number' ? 'duration' : 'tokens';

  const sb = db();
  const today = todayUtcDate();

  const { error: dailyError } = await sb.rpc('increment_ai_platform_usage_daily', {
    p_organization_id: input.organizationId,
    p_usage_date: today,
    p_call_count: 1,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_estimated_cost_usd: estimatedCostUsd,
    p_credits_consumed: creditsConsumed,
  });

  if (dailyError) {
    // Fallback when RPC not yet applied (local dev before migrate)
    const { data: existing } = await sb
      .from('ai_platform_usage_daily')
      .select('id, call_count, input_tokens, output_tokens, estimated_cost_usd, credits_consumed')
      .eq('organization_id', input.organizationId)
      .eq('usage_date', today)
      .maybeSingle();

    if (existing?.id) {
      await sb
        .from('ai_platform_usage_daily')
        .update({
          call_count: Number(existing.call_count ?? 0) + 1,
          input_tokens: Number(existing.input_tokens ?? 0) + inputTokens,
          output_tokens: Number(existing.output_tokens ?? 0) + outputTokens,
          estimated_cost_usd: Number(existing.estimated_cost_usd ?? 0) + estimatedCostUsd,
          credits_consumed: Number(existing.credits_consumed ?? 0) + creditsConsumed,
        })
        .eq('id', existing.id);
    } else {
      await sb.from('ai_platform_usage_daily').insert({
        organization_id: input.organizationId,
        usage_date: today,
        call_count: 1,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: estimatedCostUsd,
        credits_consumed: creditsConsumed,
      });
    }
  }

  if (input.propertyId) {
    const { error: propertyDailyError } = await sb.rpc(
      'increment_ai_platform_property_usage_daily',
      {
        p_organization_id: input.organizationId,
        p_property_id: input.propertyId,
        p_usage_date: today,
        p_call_count: 1,
        p_input_tokens: inputTokens,
        p_output_tokens: outputTokens,
        p_estimated_cost_usd: estimatedCostUsd,
        p_credits_consumed: creditsConsumed,
      }
    );

    if (propertyDailyError) {
      console.warn(
        '[aiUsageService] property usage RPC failed (non-fatal):',
        propertyDailyError.message
      );
    }
  }

  const { data: eventRow, error: eventError } = await sb
    .from('ai_platform_usage_events')
    .insert({
      organization_id: input.organizationId,
      property_id: input.propertyId ?? null,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      input_tokens: inputTokens || null,
      output_tokens: outputTokens || null,
      estimated_cost_usd: estimatedCostUsd,
      actor_user_id: input.actorUserId ?? null,
      actor_type: input.actorType ?? null,
      duration_seconds: input.durationSeconds ?? null,
      cost_basis: costBasis,
      credits_consumed: creditsConsumed,
    })
    .select('id')
    .maybeSingle();
  if (eventError) {
    console.warn('[aiUsageService] usage event insert failed:', eventError.message);
  }

  // Wallet debit: once this org's (or property's) credit allowance was already exhausted
  // BEFORE this call (not by it — the call that crosses the threshold is still covered by
  // the allowance), it drew from the purchased top-up wallet at the gate
  // (assertOrgAndPropertyAiQuota), so debit it here. Must mirror every condition that gate
  // checks — daily AND monthly, org AND property — or a call admitted via the wallet never
  // actually gets debited. The wallet write itself is atomic (adjustOrgCreditWallet uses a
  // row-locked RPC); this whole block is still wrapped in try/catch because the allow/deny
  // decision already happened earlier, so a failure recording the debit must never block a
  // call that already ran.
  if (creditsConsumed > 0) {
    try {
      const orgSummary = await getOrgAiUsageSummary(input.organizationId);
      const orgSettings = await getAiPlatformOrgSettings(input.organizationId);
      const priorOrgSummary = {
        todayCreditsConsumed: orgSummary.todayCreditsConsumed - creditsConsumed,
        monthCreditsConsumed: orgSummary.monthCreditsConsumed - creditsConsumed,
      };
      let exceeded = creditAllowanceExceeded(priorOrgSummary, orgSettings).exceeded;

      if (!exceeded && input.propertyId) {
        const propertySettings = await getAiPlatformPropertySettings(
          input.propertyId,
          input.organizationId
        );
        const propertySummary = await getPropertyAiUsageSummary(
          input.propertyId,
          input.organizationId
        );
        const priorPropertySummary = {
          todayCreditsConsumed: propertySummary.todayCreditsConsumed - creditsConsumed,
          monthCreditsConsumed: propertySummary.monthCreditsConsumed - creditsConsumed,
        };
        exceeded = creditAllowanceExceeded(priorPropertySummary, {
          dailyCreditLimit: propertySettings.dailyCreditLimit ?? orgSettings.dailyCreditLimit,
          monthlyCreditLimit: propertySettings.monthlyCreditLimit ?? orgSettings.monthlyCreditLimit,
        }).exceeded;
      }

      if (exceeded) {
        await adjustOrgCreditWallet({
          organizationId: input.organizationId,
          creditsDelta: -creditsConsumed,
          entryType: 'usage_debit',
          description: `${input.feature} usage over credit allowance`,
          relatedUsageEventId: (eventRow?.id as string | undefined) ?? null,
        });
      }
    } catch (err) {
      console.warn('[aiUsageService] wallet debit failed (non-fatal):', (err as Error).message);
    }
  }

  return { creditsConsumed, usageEventId: (eventRow?.id as string | undefined) ?? null };
}

export async function recordAiUsageOptional(
  organizationId: string | null | undefined,
  input: Omit<RecordAiUsageInput, 'organizationId'>
): Promise<{ creditsConsumed: number; usageEventId: string | null } | null> {
  if (!organizationId) return null;
  return recordAiUsage({ ...input, organizationId });
}

export function isAiQuotaError(error: unknown): error is AiQuotaExceededError {
  return error instanceof AiQuotaExceededError;
}

export function isAiPlatformDisabledError(error: unknown): error is AiPlatformDisabledError {
  return error instanceof AiPlatformDisabledError;
}

export function isAiFeatureDisabledError(error: unknown): error is AiFeatureDisabledError {
  return error instanceof AiFeatureDisabledError;
}
