/**
 * aiLimitAdmin — super-admin service layer for AI limit profiles, assignments and overrides.
 * Thin edge handler: `super-admin-ai-limits`. Every function here assumes the caller already
 * passed `serveSuperAdmin` + step-up; nothing here is reachable by hosts.
 *
 * Pure validators are exported for unit tests; DB functions use the service-role client.
 */

import {
  AI_LIMIT_KEYS,
  AI_LIMIT_PROFILE_COLUMNS,
  clearAiLimitCache,
  type AiLimitKey,
  type AiLimitProfile,
  isAiLimitKey,
  listAiLimitProfiles,
  mapProfileRow,
  orgOverrideValues,
  parseAiLimitValue,
  propertyOverrideValues,
  resolveOrgAiLimitsBatch,
  resolveOrgPropertiesAiLimits,
  type ResolvedAiLimits,
} from './aiLimitResolver.ts';
import { upsertAiPlatformOrgSettings, upsertAiPlatformPropertySettings } from './aiUsageService.ts';
import { upsertDashboardAssistantOrgSettings } from './dashboardAssistantSettings.ts';
import { createServiceClient } from './orgAuth.ts';
import { updateVoiceReceptionistPropertyLimits } from './voiceReceptionistService.ts';
import { patchMarketingGenerationOverrides } from './marketingGenerationFeatureConfig.ts';

export const MAX_BULK_TARGETS = 200;
export const MATRIX_ORG_CAP = 1000;

export type AiLimitScope = 'organization' | 'property' | 'development';
export type AiLimitOverrideScope = 'organization' | 'property';

export class AiLimitAdminError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'AiLimitAdminError';
  }
}

// ─── Pure validators ─────────────────────────────────────────────────────────

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export const ORG_OVERRIDE_KEYS: readonly AiLimitKey[] = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
  'assistantDailyMessageLimit',
  'assistantMonthlyMessageLimit',
  'assistantDailyWriteActionLimit',
];

export const PROPERTY_OVERRIDE_KEYS: readonly AiLimitKey[] = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
  'voiceMaxSessionSeconds',
  'voiceMaxSessionsPerGuestPerDay',
  'voiceMaxConcurrentSessions',
  'imageMonthlyCreditCap',
  'videoMonthlyCreditCap',
];

/** Validates a `{ key: value | null }` map. Unknown keys and out-of-scope keys are rejected. */
export function parseLimitsMap(
  raw: unknown,
  allowedKeys: readonly AiLimitKey[] = AI_LIMIT_KEYS
): Partial<Record<AiLimitKey, number | null>> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AiLimitAdminError('limits must be an object');
  }
  const out: Partial<Record<AiLimitKey, number | null>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isAiLimitKey(key)) throw new AiLimitAdminError(`Unknown limit "${key}"`);
    if (!allowedKeys.includes(key)) {
      throw new AiLimitAdminError(`"${key}" cannot be set at this level`);
    }
    const parsed = parseAiLimitValue(key, value);
    if (!parsed.ok) throw new AiLimitAdminError(parsed.error);
    out[key] = parsed.value;
  }
  return out;
}

export type ProfileInput = {
  code?: string;
  name?: string;
  description?: string | null;
  limits?: Partial<Record<AiLimitKey, number | null>>;
};

export function parseProfileInput(
  body: Record<string, unknown>,
  mode: 'create' | 'update'
): ProfileInput {
  const out: ProfileInput = {};
  if (mode === 'create' || body.code !== undefined) {
    const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
    if (!CODE_PATTERN.test(code)) {
      throw new AiLimitAdminError(
        'code must be 1-40 characters: lowercase letters, numbers, dashes or underscores'
      );
    }
    out.code = code;
  }
  if (mode === 'create' || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      throw new AiLimitAdminError('name must be 1-80 characters');
    }
    out.name = name;
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      throw new AiLimitAdminError('description must be a string or null');
    }
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    if (description && description.length > 300) {
      throw new AiLimitAdminError('description must be 300 characters or fewer');
    }
    out.description = description || null;
  }
  if (body.limits !== undefined) out.limits = parseLimitsMap(body.limits);
  return out;
}

export function parseTargetIds(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AiLimitAdminError('scopeIds must be a non-empty array');
  }
  const ids = Array.from(new Set(raw.map((v) => (typeof v === 'string' ? v.trim() : ''))));
  if (ids.some((id) => !id)) throw new AiLimitAdminError('scopeIds must be strings');
  if (ids.length > MAX_BULK_TARGETS) {
    throw new AiLimitAdminError(`At most ${MAX_BULK_TARGETS} targets per request`);
  }
  return ids;
}

export function parseScope<T extends AiLimitScope>(raw: unknown, allowed: readonly T[]): T {
  if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
    throw new AiLimitAdminError(`scope must be one of: ${allowed.join(', ')}`);
  }
  return raw as T;
}

/** An override needs a human reason so a leftover number is always explainable. */
export function requireOverrideReason(
  limits: Partial<Record<AiLimitKey, number | null>>,
  rawReason: unknown
): string | null {
  const setsValue = Object.values(limits).some((v) => v !== null && v !== undefined);
  const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
  if (setsValue && reason.length < 3) {
    throw new AiLimitAdminError('A reason is required when setting an override');
  }
  if (reason.length > 200) throw new AiLimitAdminError('reason must be 200 characters or fewer');
  return setsValue ? reason : null;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

function profileWriteColumns(input: ProfileInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.code !== undefined) row.code = input.code;
  if (input.name !== undefined) row.name = input.name;
  if (input.description !== undefined) row.description = input.description;
  for (const [key, value] of Object.entries(input.limits ?? {})) {
    row[AI_LIMIT_PROFILE_COLUMNS[key as AiLimitKey]] = value;
  }
  return row;
}

async function fetchProfile(id: string): Promise<AiLimitProfile | null> {
  const profiles = await listAiLimitProfiles();
  return profiles.find((p) => p.id === id) ?? null;
}

export async function createProfile(input: ProfileInput, adminId: string): Promise<AiLimitProfile> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('ai_limit_profiles')
    .insert({ ...profileWriteColumns(input), updated_by: adminId })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new AiLimitAdminError('A profile with this code exists', 409);
    throw new Error(error.message);
  }
  const created = await fetchProfile(String(data.id));
  if (!created) throw new Error('Profile not found after create');
  return created;
}

export async function updateProfile(
  id: string,
  input: ProfileInput,
  adminId: string
): Promise<{ before: AiLimitProfile; after: AiLimitProfile }> {
  const before = await fetchProfile(id);
  if (!before) throw new AiLimitAdminError('Profile not found', 404);
  if (before.isDefault && input.code !== undefined && input.code !== before.code) {
    throw new AiLimitAdminError('The default profile code cannot change');
  }
  const row = profileWriteColumns(input);
  if (Object.keys(row).length === 0) throw new AiLimitAdminError('Nothing to update');
  const { error } = await createServiceClient()
    .from('ai_limit_profiles')
    .update({ ...row, updated_by: adminId })
    .eq('id', id);
  if (error) {
    if (error.code === '23505') throw new AiLimitAdminError('A profile with this code exists', 409);
    throw new Error(error.message);
  }
  clearAiLimitCache();
  const after = await fetchProfile(id);
  if (!after) throw new Error('Profile not found after update');
  return { before, after };
}

export async function deleteProfile(id: string): Promise<AiLimitProfile> {
  const sb = createServiceClient();
  const profile = await fetchProfile(id);
  if (!profile) throw new AiLimitAdminError('Profile not found', 404);
  if (profile.isDefault) throw new AiLimitAdminError('The default profile cannot be deleted');

  const [assignments, plans] = await Promise.all([
    sb
      .from('ai_limit_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', id),
    sb
      .from('pricing_plans')
      .select('id', { count: 'exact', head: true })
      .eq('ai_limit_profile_id', id),
  ]);
  if (assignments.error) throw new Error(assignments.error.message);
  if (plans.error) throw new Error(plans.error.message);
  if ((assignments.count ?? 0) > 0 || (plans.count ?? 0) > 0) {
    throw new AiLimitAdminError('Unassign this profile from every tenant and plan before deleting');
  }
  const { error } = await sb.from('ai_limit_profiles').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return profile;
}

// ─── Assignments ─────────────────────────────────────────────────────────────

const SCOPE_TABLE: Record<AiLimitScope, string> = {
  organization: 'organizations',
  property: 'properties',
  development: 'developments',
};

async function assertTargetsExist(scope: AiLimitScope, ids: string[]): Promise<void> {
  const { data, error } = await createServiceClient()
    .from(SCOPE_TABLE[scope])
    .select('id')
    .in('id', ids);
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r) => String(r.id)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new AiLimitAdminError(`Unknown ${scope} id: ${missing.slice(0, 3).join(', ')}`, 404);
  }
}

/** Resolve which organizations a set of scope targets belongs to (for activity mirroring). */
export async function organizationIdsForTargets(
  scope: AiLimitScope,
  ids: string[]
): Promise<Map<string, string[]>> {
  const sb = createServiceClient();
  const out = new Map<string, string[]>();
  const add = (orgId: string, targetId: string) =>
    out.set(orgId, [...(out.get(orgId) ?? []), targetId]);

  if (scope === 'organization') {
    for (const id of ids) add(id, id);
  } else if (scope === 'property') {
    const { data, error } = await sb.from('properties').select('id, organization_id').in('id', ids);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) add(String(row.organization_id), String(row.id));
  } else {
    const { data: devs, error: devError } = await sb
      .from('developments')
      .select('id, name')
      .in('id', ids);
    if (devError) throw new Error(devError.message);
    const byName = new Map((devs ?? []).map((d) => [String(d.name), String(d.id)]));
    if (byName.size > 0) {
      const { data, error } = await sb
        .from('properties')
        .select('organization_id, residence_name')
        .in('residence_name', Array.from(byName.keys()));
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const devId = byName.get(String(row.residence_name));
        if (devId) add(String(row.organization_id), devId);
      }
    }
  }
  return out;
}

export async function assignProfile(input: {
  scope: AiLimitScope;
  scopeIds: string[];
  profileId: string | null;
  note: string | null;
  adminId: string;
}): Promise<{ profile: AiLimitProfile | null; affected: number }> {
  const sb = createServiceClient();
  await assertTargetsExist(input.scope, input.scopeIds);

  if (input.profileId === null) {
    const { error } = await sb
      .from('ai_limit_assignments')
      .delete()
      .eq('scope', input.scope)
      .in('scope_id', input.scopeIds);
    if (error) throw new Error(error.message);
    clearAiLimitCache();
    return { profile: null, affected: input.scopeIds.length };
  }

  const profile = await fetchProfile(input.profileId);
  if (!profile) throw new AiLimitAdminError('Profile not found', 404);
  clearAiLimitCache();
  const { error } = await sb.from('ai_limit_assignments').upsert(
    input.scopeIds.map((scopeId) => ({
      scope: input.scope,
      scope_id: scopeId,
      profile_id: input.profileId,
      assigned_by: input.adminId,
      assigned_at: new Date().toISOString(),
      note: input.note,
    })),
    { onConflict: 'scope,scope_id' }
  );
  if (error) throw new Error(error.message);
  return { profile, affected: input.scopeIds.length };
}

export async function setPlanProfile(
  planId: string,
  profileId: string | null
): Promise<{ code: string; name: string; profile: AiLimitProfile | null }> {
  const sb = createServiceClient();
  const profile = profileId ? await fetchProfile(profileId) : null;
  if (profileId && !profile) throw new AiLimitAdminError('Profile not found', 404);
  const { data, error } = await sb
    .from('pricing_plans')
    .update({ ai_limit_profile_id: profileId })
    .eq('id', planId)
    .select('code, name')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AiLimitAdminError('Plan not found', 404);
  clearAiLimitCache();
  return { code: String(data.code), name: String(data.name), profile };
}

// ─── Overrides ───────────────────────────────────────────────────────────────

function pick(
  limits: Partial<Record<AiLimitKey, number | null>>,
  keys: readonly AiLimitKey[]
): Partial<Record<AiLimitKey, number | null>> {
  const out: Partial<Record<AiLimitKey, number | null>> = {};
  for (const key of keys) if (limits[key] !== undefined) out[key] = limits[key];
  return out;
}

const NUMERIC_ORG_KEYS: readonly AiLimitKey[] = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
];

async function setOrgOverrides(
  organizationId: string,
  limits: Partial<Record<AiLimitKey, number | null>>,
  reason: string | null,
  adminId: string
): Promise<void> {
  const platform = pick(limits, NUMERIC_ORG_KEYS);
  const assistant = pick(limits, [
    'assistantDailyMessageLimit',
    'assistantMonthlyMessageLimit',
    'assistantDailyWriteActionLimit',
  ]);
  const sb = createServiceClient();

  if (Object.keys(platform).length > 0) {
    await upsertAiPlatformOrgSettings({
      organizationId,
      dailyCallLimit: platform.dailyCallLimit,
      monthlyCallLimit: platform.monthlyCallLimit,
      dailyCostUsdLimit: platform.dailyCostUsdLimit,
      dailyCreditLimit: platform.dailyCreditLimit,
      monthlyCreditLimit: platform.monthlyCreditLimit,
      overrideReason: reason,
      updatedBy: adminId,
    });
  }
  if (Object.keys(assistant).length > 0) {
    await upsertDashboardAssistantOrgSettings({
      organizationId,
      dailyMessageLimit: assistant.assistantDailyMessageLimit,
      monthlyMessageLimit: assistant.assistantMonthlyMessageLimit,
      dailyWriteActionLimit: assistant.assistantDailyWriteActionLimit,
      overrideReason: reason,
      updatedBy: adminId,
    });
  }

  // Clearing every override must also clear the reason on both rows.
  const [orgRes, assistantRes] = await Promise.all([
    sb
      .from('ai_platform_org_settings')
      .select(
        'daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit'
      )
      .eq('organization_id', organizationId)
      .maybeSingle(),
    sb
      .from('ai_dashboard_assistant_org_settings')
      .select('daily_message_limit, monthly_message_limit, daily_write_action_limit')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);
  const remaining = orgOverrideValues(orgRes.data, assistantRes.data);
  if (!AI_LIMIT_KEYS.some((key) => remaining[key] != null)) {
    await Promise.all([
      sb
        .from('ai_platform_org_settings')
        .update({ override_reason: null, overridden_by: null })
        .eq('organization_id', organizationId),
      sb
        .from('ai_dashboard_assistant_org_settings')
        .update({ override_reason: null, overridden_by: null })
        .eq('organization_id', organizationId),
    ]);
  }
}

async function setPropertyOverrides(
  propertyId: string,
  organizationId: string,
  limits: Partial<Record<AiLimitKey, number | null>>,
  reason: string | null,
  adminId: string
): Promise<void> {
  const platform = pick(limits, NUMERIC_ORG_KEYS);
  const voice = pick(limits, [
    'voiceMaxSessionSeconds',
    'voiceMaxSessionsPerGuestPerDay',
    'voiceMaxConcurrentSessions',
  ]);
  const media = pick(limits, ['imageMonthlyCreditCap', 'videoMonthlyCreditCap']);

  if (Object.keys(platform).length > 0) {
    await upsertAiPlatformPropertySettings({
      propertyId,
      organizationId,
      dailyCallLimit: platform.dailyCallLimit,
      monthlyCallLimit: platform.monthlyCallLimit,
      dailyCostUsdLimit: platform.dailyCostUsdLimit,
      dailyCreditLimit: platform.dailyCreditLimit,
      monthlyCreditLimit: platform.monthlyCreditLimit,
      updatedBy: adminId,
    });
  }
  if (Object.keys(voice).length > 0) {
    await updateVoiceReceptionistPropertyLimits(propertyId, {
      maxSessionSeconds: voice.voiceMaxSessionSeconds,
      maxSessionsPerGuestPerDay: voice.voiceMaxSessionsPerGuestPerDay,
      maxConcurrentSessions: voice.voiceMaxConcurrentSessions,
    });
  }
  if (Object.keys(media).length > 0) {
    await patchMarketingGenerationOverrides({
      propertyId,
      organizationId,
      patch: {
        imageMonthlyCreditCap: media.imageMonthlyCreditCap,
        videoMonthlyCreditCap: media.videoMonthlyCreditCap,
      },
      updatedBy: adminId,
    });
  }

  const sb = createServiceClient();
  const { data } = await sb
    .from('ai_platform_property_settings')
    .select(
      'daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, feature_configs'
    )
    .eq('property_id', propertyId)
    .maybeSingle();
  const remaining = propertyOverrideValues(data);
  const hasAny = AI_LIMIT_KEYS.some((key) => remaining[key] != null);
  await upsertAiPlatformPropertySettings({
    propertyId,
    organizationId,
    overrideReason: hasAny ? (reason ?? undefined) : null,
    updatedBy: adminId,
  });
}

export async function setOverrides(input: {
  scope: AiLimitOverrideScope;
  scopeIds: string[];
  limits: Partial<Record<AiLimitKey, number | null>>;
  reason: string | null;
  adminId: string;
}): Promise<Map<string, string[]>> {
  await assertTargetsExist(input.scope, input.scopeIds);
  const orgMap = await organizationIdsForTargets(input.scope, input.scopeIds);

  if (input.scope === 'organization') {
    for (const orgId of input.scopeIds) {
      await setOrgOverrides(orgId, input.limits, input.reason, input.adminId);
    }
  } else {
    const propertyOrg = new Map<string, string>();
    for (const [orgId, propertyIds] of orgMap) {
      for (const propertyId of propertyIds) propertyOrg.set(propertyId, orgId);
    }
    for (const propertyId of input.scopeIds) {
      const orgId = propertyOrg.get(propertyId);
      if (!orgId) throw new AiLimitAdminError(`Property ${propertyId} has no organization`, 404);
      await setPropertyOverrides(propertyId, orgId, input.limits, input.reason, input.adminId);
    }
  }
  return orgMap;
}

// ─── Read models ─────────────────────────────────────────────────────────────

function monthStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

export type MatrixFilters = {
  search: string;
  planTier: string;
  profileCode: string;
  status: 'all' | 'breach' | 'overridden' | 'disabled';
  limit: number;
  offset: number;
};

export type MatrixRow = {
  organizationId: string;
  name: string;
  slug: string;
  planTier: string;
  aiEnabled: boolean;
  orgProfileCode: string | null;
  planProfileCode: string | null;
  hasOverrides: boolean;
  overrideReason: string | null;
  limits: ResolvedAiLimits;
  usage: {
    todayCalls: number;
    todayCostUsd: number;
    monthCalls: number;
    monthCostUsd: number;
    monthCredits: number;
  };
  breach: boolean;
};

export async function loadMatrix(filters: MatrixFilters): Promise<{
  rows: MatrixRow[];
  total: number;
  truncated: boolean;
  planTiers: string[];
}> {
  const sb = createServiceClient();
  let query = sb
    .from('organizations')
    .select('id, name, slug')
    .order('name')
    .limit(MATRIX_ORG_CAP + 1);
  const search = filters.search.trim().replace(/[%,()]/g, ' ');
  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  const { data: orgs, error } = await query;
  if (error) throw new Error(error.message);
  const truncated = (orgs?.length ?? 0) > MATRIX_ORG_CAP;
  const orgRows = (orgs ?? []).slice(0, MATRIX_ORG_CAP);
  const ids = orgRows.map((o) => String(o.id));

  const [resolved, enabledRes, usageRes] = await Promise.all([
    resolveOrgAiLimitsBatch(ids),
    sb.from('ai_platform_org_settings').select('organization_id, enabled').limit(50_000),
    sb
      .from('ai_platform_usage_daily')
      .select('organization_id, usage_date, call_count, estimated_cost_usd, credits_consumed')
      .gte('usage_date', monthStartUtc())
      .limit(200_000),
  ]);
  if (enabledRes.error) throw new Error(enabledRes.error.message);
  if (usageRes.error) throw new Error(usageRes.error.message);

  const enabled = new Map(
    (enabledRes.data ?? []).map((r) => [String(r.organization_id), r.enabled !== false])
  );
  const usage = new Map<string, MatrixRow['usage']>();
  const today = todayUtc();
  for (const r of usageRes.data ?? []) {
    const id = String(r.organization_id);
    const u = usage.get(id) ?? {
      todayCalls: 0,
      todayCostUsd: 0,
      monthCalls: 0,
      monthCostUsd: 0,
      monthCredits: 0,
    };
    u.monthCalls += Number(r.call_count ?? 0);
    u.monthCostUsd += Number(r.estimated_cost_usd ?? 0);
    u.monthCredits += Number(r.credits_consumed ?? 0);
    if (r.usage_date === today) {
      u.todayCalls += Number(r.call_count ?? 0);
      u.todayCostUsd += Number(r.estimated_cost_usd ?? 0);
    }
    usage.set(id, u);
  }

  const all: MatrixRow[] = [];
  const planTiers = new Set<string>();
  for (const o of orgRows) {
    const id = String(o.id);
    const r = resolved.get(id);
    if (!r) continue;
    planTiers.add(r.planTier);
    const u = usage.get(id) ?? {
      todayCalls: 0,
      todayCostUsd: 0,
      monthCalls: 0,
      monthCostUsd: 0,
      monthCredits: 0,
    };
    const l = r.limits;
    const breach =
      u.todayCalls >= (l.dailyCallLimit.value ?? Infinity) ||
      u.monthCalls >= (l.monthlyCallLimit.value ?? Infinity) ||
      u.todayCostUsd >= (l.dailyCostUsdLimit.value ?? Infinity);
    all.push({
      organizationId: id,
      name: String(o.name),
      slug: String(o.slug),
      planTier: r.planTier,
      aiEnabled: enabled.get(id) ?? true,
      orgProfileCode: r.orgProfileCode,
      planProfileCode: r.planProfileCode,
      hasOverrides: r.hasOverrides,
      overrideReason: r.overrideReason,
      limits: r.limits,
      usage: {
        todayCalls: u.todayCalls,
        todayCostUsd: round(u.todayCostUsd),
        monthCalls: u.monthCalls,
        monthCostUsd: round(u.monthCostUsd),
        monthCredits: round(u.monthCredits, 2),
      },
      breach,
    });
  }

  const filtered = all.filter((row) => {
    if (filters.planTier && row.planTier !== filters.planTier) return false;
    if (filters.profileCode) {
      const code = row.orgProfileCode ?? row.planProfileCode ?? 'default';
      if (code !== filters.profileCode) return false;
    }
    if (filters.status === 'breach') return row.breach;
    if (filters.status === 'overridden') return row.hasOverrides;
    if (filters.status === 'disabled') return !row.aiEnabled;
    return true;
  });

  return {
    rows: filtered.slice(filters.offset, filters.offset + filters.limit),
    total: filtered.length,
    truncated,
    planTiers: Array.from(planTiers).sort(),
  };
}

export type ProfileUsage = {
  organizationAssignments: number;
  propertyAssignments: number;
  developmentAssignments: number;
  plans: Array<{ id: string; code: string; name: string }>;
  affectedOrganizations: number;
  spend30dUsd: number;
};

export async function loadProfilesOverview(): Promise<{
  profiles: Array<AiLimitProfile & { usage: ProfileUsage }>;
  developments: Array<{
    id: string;
    name: string;
    propertyCount: number;
    profileId: string | null;
    profileCode: string | null;
  }>;
  plans: Array<{
    id: string;
    code: string;
    name: string;
    profileId: string | null;
    profileCode: string | null;
  }>;
}> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [profiles, assignRes, plansRes, devRes, propRes, settingsRes, orgsRes, usageRes] =
    await Promise.all([
      listAiLimitProfiles(),
      sb.from('ai_limit_assignments').select('scope, scope_id, profile_id').limit(50_000),
      sb.from('pricing_plans').select('id, code, name, ai_limit_profile_id').order('sort_order'),
      sb.from('developments').select('id, name').order('name'),
      sb.from('properties').select('id, organization_id, residence_name').limit(50_000),
      sb.from('ai_platform_org_settings').select('organization_id, plan_tier').limit(50_000),
      sb.from('organizations').select('id').limit(50_000),
      sb
        .from('ai_platform_usage_daily')
        .select('organization_id, estimated_cost_usd')
        .gte('usage_date', since)
        .limit(200_000),
    ]);
  for (const res of [assignRes, plansRes, devRes, propRes, settingsRes, orgsRes, usageRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const planRows = (plansRes.data ?? []).map((p) => ({
    id: String(p.id),
    code: String(p.code),
    name: String(p.name),
    profileId: p.ai_limit_profile_id ? String(p.ai_limit_profile_id) : null,
  }));
  const propertyOrg = new Map(
    (propRes.data ?? []).map((p) => [String(p.id), String(p.organization_id)])
  );
  const devByName = new Map((devRes.data ?? []).map((d) => [String(d.name), String(d.id)]));
  const devPropertyCount = new Map<string, number>();
  const devOrgs = new Map<string, Set<string>>();
  for (const p of propRes.data ?? []) {
    const devId = devByName.get(String(p.residence_name ?? ''));
    if (!devId) continue;
    devPropertyCount.set(devId, (devPropertyCount.get(devId) ?? 0) + 1);
    const set = devOrgs.get(devId) ?? new Set<string>();
    set.add(String(p.organization_id));
    devOrgs.set(devId, set);
  }
  const orgPlan = new Map(
    (settingsRes.data ?? []).map((s) => [
      String(s.organization_id),
      String(s.plan_tier ?? 'included'),
    ])
  );
  const spendByOrg = new Map<string, number>();
  for (const u of usageRes.data ?? []) {
    const id = String(u.organization_id);
    spendByOrg.set(id, (spendByOrg.get(id) ?? 0) + Number(u.estimated_cost_usd ?? 0));
  }

  const assignmentsFor = (profileId: string, scope: AiLimitScope) =>
    (assignRes.data ?? []).filter((a) => a.profile_id === profileId && a.scope === scope);
  const orgAssigned = new Set(
    (assignRes.data ?? []).filter((a) => a.scope === 'organization').map((a) => String(a.scope_id))
  );
  const planProfileByCode = new Map(planRows.map((p) => [p.code, p.profileId]));

  const withUsage = profiles.map((profile) => {
    const cohort = new Set<string>();
    const orgAssignments = assignmentsFor(profile.id, 'organization');
    const propertyAssignments = assignmentsFor(profile.id, 'property');
    const developmentAssignments = assignmentsFor(profile.id, 'development');
    for (const a of orgAssignments) cohort.add(String(a.scope_id));
    for (const a of propertyAssignments) {
      const orgId = propertyOrg.get(String(a.scope_id));
      if (orgId) cohort.add(orgId);
    }
    for (const a of developmentAssignments) {
      for (const orgId of devOrgs.get(String(a.scope_id)) ?? []) cohort.add(orgId);
    }
    const plans = planRows.filter((p) => p.profileId === profile.id);
    const planCodes = new Set(plans.map((p) => p.code));
    for (const org of orgsRes.data ?? []) {
      const id = String(org.id);
      if (orgAssigned.has(id)) continue;
      const tier = orgPlan.get(id) ?? 'included';
      const boundProfile = planProfileByCode.get(tier) ?? null;
      if (planCodes.has(tier)) cohort.add(id);
      else if (profile.isDefault && boundProfile === null) cohort.add(id);
    }
    let spend = 0;
    for (const id of cohort) spend += spendByOrg.get(id) ?? 0;
    return {
      ...profile,
      usage: {
        organizationAssignments: orgAssignments.length,
        propertyAssignments: propertyAssignments.length,
        developmentAssignments: developmentAssignments.length,
        plans: plans.map(({ id, code, name }) => ({ id, code, name })),
        affectedOrganizations: cohort.size,
        spend30dUsd: round(spend, 2),
      },
    };
  });

  const devAssignments = new Map(
    (assignRes.data ?? [])
      .filter((a) => a.scope === 'development')
      .map((a) => [String(a.scope_id), String(a.profile_id)])
  );

  return {
    profiles: withUsage,
    developments: (devRes.data ?? []).map((d) => {
      const id = String(d.id);
      const profileId = devAssignments.get(id) ?? null;
      return {
        id,
        name: String(d.name),
        propertyCount: devPropertyCount.get(id) ?? 0,
        profileId,
        profileCode: profileId ? (byId.get(profileId)?.code ?? null) : null,
      };
    }),
    plans: planRows.map((p) => ({
      ...p,
      profileCode: p.profileId ? (byId.get(p.profileId)?.code ?? null) : null,
    })),
  };
}

export async function loadOrgDetail(organizationId: string) {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [
    { data: org, error },
    orgResolved,
    properties,
    assignRes,
    profiles,
    dailyRes,
    propertyUsageRes,
  ] = await Promise.all([
    sb.from('organizations').select('id, name, slug').eq('id', organizationId).maybeSingle(),
    resolveOrgAiLimitsBatch([organizationId]),
    resolveOrgPropertiesAiLimits(organizationId),
    sb
      .from('ai_limit_assignments')
      .select('scope, scope_id, profile_id')
      .eq('scope', 'organization')
      .eq('scope_id', organizationId)
      .maybeSingle(),
    listAiLimitProfiles(),
    sb
      .from('ai_platform_usage_daily')
      .select('usage_date, call_count, estimated_cost_usd')
      .eq('organization_id', organizationId)
      .gte('usage_date', since)
      .order('usage_date'),
    sb
      .from('ai_platform_property_usage_daily')
      .select('property_id, call_count, estimated_cost_usd')
      .eq('organization_id', organizationId)
      .gte('usage_date', monthStartUtc()),
  ]);
  if (error) throw new Error(error.message);
  if (!org) throw new AiLimitAdminError('Organization not found', 404);
  if (assignRes.error) throw new Error(assignRes.error.message);
  if (dailyRes.error) throw new Error(dailyRes.error.message);
  if (propertyUsageRes.error) throw new Error(propertyUsageRes.error.message);

  const propertyUsage = new Map<string, { monthCalls: number; monthCostUsd: number }>();
  for (const row of propertyUsageRes.data ?? []) {
    const id = String(row.property_id);
    const current = propertyUsage.get(id) ?? { monthCalls: 0, monthCostUsd: 0 };
    current.monthCalls += Number(row.call_count ?? 0);
    current.monthCostUsd += Number(row.estimated_cost_usd ?? 0);
    propertyUsage.set(id, current);
  }

  const codeById = new Map(profiles.map((p) => [p.id, p.code]));
  const assignment = assignRes.data
    ? {
        profileId: String(assignRes.data.profile_id),
        profileCode: codeById.get(String(assignRes.data.profile_id)) ?? null,
      }
    : null;

  return {
    organization: { id: String(org.id), name: String(org.name), slug: String(org.slug) },
    resolved: orgResolved.get(organizationId) ?? null,
    assignment,
    properties: properties.map((property) => {
      const usage = propertyUsage.get(property.propertyId);
      return {
        ...property,
        usage: {
          monthCalls: usage?.monthCalls ?? 0,
          monthCostUsd: round(usage?.monthCostUsd ?? 0),
        },
      };
    }),
    dailySeries: (dailyRes.data ?? []).map((row) => ({
      date: String(row.usage_date),
      calls: Number(row.call_count ?? 0),
      costUsd: round(Number(row.estimated_cost_usd ?? 0)),
    })),
    profiles: profiles.map((p) => ({ id: p.id, code: p.code, name: p.name })),
  };
}

export { mapProfileRow };
