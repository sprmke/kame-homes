/**
 * Per-property Marketing Studio generation overrides, stored on
 * `ai_platform_property_settings.feature_configs` next to voice_receptionist.
 *
 * Keys:
 *   marketing_image_generate / marketing_video_generate
 *     monthly_credit_cap  — optional positive int; blank/null = 60% of org allowance
 *     allow_premium_tier  — super-admin escape hatch; hosts cannot set this
 *
 * Merge-only writes so a generation patch never clobbers the voice config, and a
 * voice patch never clobbers generation.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

import { ensureAiPlatformPropertySettingsRow } from './aiUsageService.ts';

export const MARKETING_IMAGE_GENERATE_FEATURE = 'marketing_image_generate' as const;
export const MARKETING_VIDEO_GENERATE_FEATURE = 'marketing_video_generate' as const;

export type MarketingGenerationMediaFeature =
  typeof MARKETING_IMAGE_GENERATE_FEATURE | typeof MARKETING_VIDEO_GENERATE_FEATURE;

export type MarketingGenerationOverrides = {
  imageMonthlyCreditCap: number | null;
  videoMonthlyCreditCap: number | null;
  allowPremiumImage: boolean;
  allowPremiumVideo: boolean;
};

export const EMPTY_MARKETING_GENERATION_OVERRIDES: MarketingGenerationOverrides = {
  imageMonthlyCreditCap: null,
  videoMonthlyCreditCap: null,
  allowPremiumImage: false,
  allowPremiumVideo: false,
};

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseCap(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cap = Number(value);
  if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap <= 0) return null;
  return cap;
}

function parseFeatureBlock(
  configs: Record<string, unknown>,
  feature: MarketingGenerationMediaFeature
): { monthlyCreditCap: number | null; allowPremiumTier: boolean } {
  const block = asRecord(configs[feature]);
  return {
    monthlyCreditCap: parseCap(block.monthly_credit_cap),
    allowPremiumTier: block.allow_premium_tier === true,
  };
}

export function parseMarketingGenerationOverrides(
  featureConfigs: unknown
): MarketingGenerationOverrides {
  const configs = asRecord(featureConfigs);
  const image = parseFeatureBlock(configs, MARKETING_IMAGE_GENERATE_FEATURE);
  const video = parseFeatureBlock(configs, MARKETING_VIDEO_GENERATE_FEATURE);
  return {
    imageMonthlyCreditCap: image.monthlyCreditCap,
    videoMonthlyCreditCap: video.monthlyCreditCap,
    allowPremiumImage: image.allowPremiumTier,
    allowPremiumVideo: video.allowPremiumTier,
  };
}

export function monthlyCreditCapForFeature(
  overrides: MarketingGenerationOverrides,
  feature: MarketingGenerationMediaFeature
): number | null {
  return feature === MARKETING_VIDEO_GENERATE_FEATURE
    ? overrides.videoMonthlyCreditCap
    : overrides.imageMonthlyCreditCap;
}

export function allowPremiumForFeature(
  overrides: MarketingGenerationOverrides,
  feature: MarketingGenerationMediaFeature
): boolean {
  return feature === MARKETING_VIDEO_GENERATE_FEATURE
    ? overrides.allowPremiumVideo
    : overrides.allowPremiumImage;
}

export type MarketingGenerationOverridesPatch = {
  imageMonthlyCreditCap?: number | null;
  videoMonthlyCreditCap?: number | null;
  allowPremiumImage?: boolean;
  allowPremiumVideo?: boolean;
};

function applyCap(
  block: Record<string, unknown>,
  cap: number | null | undefined
): Record<string, unknown> {
  if (cap === undefined) return block;
  if (cap === null) {
    const { monthly_credit_cap: _removed, ...rest } = block;
    return rest;
  }
  return { ...block, monthly_credit_cap: cap };
}

function applyPremium(
  block: Record<string, unknown>,
  allowed: boolean | undefined
): Record<string, unknown> {
  if (allowed === undefined) return block;
  if (!allowed) {
    const { allow_premium_tier: _removed, ...rest } = block;
    return rest;
  }
  return { ...block, allow_premium_tier: true };
}

/** Merge generation keys into an existing feature_configs object. Other keys stay. */
export function mergeMarketingGenerationFeatureConfigs(
  existing: unknown,
  patch: MarketingGenerationOverridesPatch
): Record<string, unknown> {
  const configs = asRecord(existing);
  let image = asRecord(configs[MARKETING_IMAGE_GENERATE_FEATURE]);
  let video = asRecord(configs[MARKETING_VIDEO_GENERATE_FEATURE]);

  image = applyCap(image, patch.imageMonthlyCreditCap);
  image = applyPremium(image, patch.allowPremiumImage);
  video = applyCap(video, patch.videoMonthlyCreditCap);
  video = applyPremium(video, patch.allowPremiumVideo);

  const next = { ...configs };
  if (Object.keys(image).length === 0) {
    delete next[MARKETING_IMAGE_GENERATE_FEATURE];
  } else {
    next[MARKETING_IMAGE_GENERATE_FEATURE] = image;
  }
  if (Object.keys(video).length === 0) {
    delete next[MARKETING_VIDEO_GENERATE_FEATURE];
  } else {
    next[MARKETING_VIDEO_GENERATE_FEATURE] = video;
  }
  return next;
}

export function parsePositiveIntOrNull(
  value: unknown,
  field: string
): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === '') return { ok: true, value: null };
  const cap = Number(value);
  if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap <= 0) {
    return { ok: false, error: `${field} must be a positive integer or blank` };
  }
  return { ok: true, value: cap };
}

export async function getMarketingGenerationOverrides(
  propertyId: string,
  organizationId: string
): Promise<MarketingGenerationOverrides> {
  await ensureAiPlatformPropertySettingsRow(propertyId, organizationId);
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_property_settings')
    .select('feature_configs')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseMarketingGenerationOverrides(data?.feature_configs);
}

export async function patchMarketingGenerationOverrides(input: {
  propertyId: string;
  organizationId: string;
  patch: MarketingGenerationOverridesPatch;
  updatedBy: string;
}): Promise<MarketingGenerationOverrides> {
  await ensureAiPlatformPropertySettingsRow(input.propertyId, input.organizationId);
  const sb = db();
  const { data: current, error: readError } = await sb
    .from('ai_platform_property_settings')
    .select('feature_configs')
    .eq('property_id', input.propertyId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const nextConfigs = mergeMarketingGenerationFeatureConfigs(current?.feature_configs, input.patch);
  const { data, error } = await sb
    .from('ai_platform_property_settings')
    .update({
      feature_configs: nextConfigs,
      updated_by: input.updatedBy,
    })
    .eq('property_id', input.propertyId)
    .select('feature_configs')
    .single();
  if (error) throw new Error(error.message);
  return parseMarketingGenerationOverrides(data.feature_configs);
}

export async function listMarketingGenerationOverridesForOrg(organizationId: string): Promise<
  Array<{
    propertyId: string;
    propertyName: string;
    overrides: MarketingGenerationOverrides;
  }>
> {
  const sb = db();
  const { data: properties, error: propError } = await sb
    .from('properties')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (propError) throw new Error(propError.message);

  const rows = properties ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => String(row.id));
  const { data: settings, error: settingsError } = await sb
    .from('ai_platform_property_settings')
    .select('property_id, feature_configs')
    .in('property_id', ids);
  if (settingsError) throw new Error(settingsError.message);

  const byProperty = new Map(
    (settings ?? []).map((row) => [
      String(row.property_id),
      parseMarketingGenerationOverrides(row.feature_configs),
    ])
  );

  return rows.map((row) => ({
    propertyId: String(row.id),
    propertyName: String(row.name ?? ''),
    overrides: byProperty.get(String(row.id)) ?? EMPTY_MARKETING_GENERATION_OVERRIDES,
  }));
}
