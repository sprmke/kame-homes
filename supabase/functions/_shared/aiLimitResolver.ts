/**
 * aiLimitResolver — single source of truth for every numeric AI limit.
 *
 * Hosts only toggle AI on/off. Every limit is owned by super admins and resolved here:
 *
 *   org scope      : override → org profile → plan profile → plan allowance → default profile → global
 *   property scope : override → property profile → development profile → (org scope chain)
 *
 * Each resolved value carries its provenance (`source` + `profileCode`) so the super-admin
 * console can explain where a number came from. `resolveFromLayers` is pure and unit-tested;
 * the loaders below only gather layers from the database.
 */

import { createServiceClient } from './orgAuth.ts';

export const AI_LIMIT_KEYS = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
  'assistantDailyMessageLimit',
  'assistantMonthlyMessageLimit',
  'assistantDailyWriteActionLimit',
  'voiceMaxSessionSeconds',
  'voiceMaxSessionsPerGuestPerDay',
  'voiceMaxConcurrentSessions',
  'imageMonthlyCreditCap',
  'videoMonthlyCreditCap',
] as const;

export type AiLimitKey = (typeof AI_LIMIT_KEYS)[number];
export type AiLimitValues = Partial<Record<AiLimitKey, number | null>>;

export type AiLimitSource =
  | 'override'
  | 'property'
  | 'development'
  | 'org'
  | 'plan'
  | 'plan_allowance'
  | 'default'
  | 'global';

export type ResolvedLimit = {
  /** `null` only for image/video caps, where null means "60% of the org allowance". */
  value: number | null;
  source: AiLimitSource;
  profileCode: string | null;
};

export type ResolvedAiLimits = Record<AiLimitKey, ResolvedLimit>;

export type AiLimitLayer = {
  source: AiLimitSource;
  profileCode?: string | null;
  values: AiLimitValues;
};

/** Hard-coded values that predate profiles. The seeded `default` profile mirrors them. */
export const AI_LIMIT_CONSTANT_DEFAULTS: AiLimitValues = {
  assistantDailyMessageLimit: 50,
  assistantMonthlyMessageLimit: 1000,
  assistantDailyWriteActionLimit: 20,
  voiceMaxSessionSeconds: 300,
  voiceMaxSessionsPerGuestPerDay: 3,
  voiceMaxConcurrentSessions: 3,
  imageMonthlyCreditCap: null,
  videoMonthlyCreditCap: null,
};

/** Validation bounds shared by the profile/override writers. `min`/`max` inclusive. */
export const AI_LIMIT_BOUNDS: Record<
  AiLimitKey,
  { min: number; max?: number; integer: boolean; label: string }
> = {
  dailyCallLimit: { min: 1, integer: true, label: 'Daily call limit' },
  monthlyCallLimit: { min: 1, integer: true, label: 'Monthly call limit' },
  dailyCostUsdLimit: { min: 0.000001, integer: false, label: 'Daily cost limit (USD)' },
  dailyCreditLimit: { min: 0, integer: false, label: 'Daily credit limit' },
  monthlyCreditLimit: { min: 0, integer: false, label: 'Monthly credit limit' },
  assistantDailyMessageLimit: { min: 1, integer: true, label: 'Assistant daily messages' },
  assistantMonthlyMessageLimit: { min: 1, integer: true, label: 'Assistant monthly messages' },
  assistantDailyWriteActionLimit: {
    min: 1,
    integer: true,
    label: 'Assistant daily write actions',
  },
  voiceMaxSessionSeconds: { min: 60, max: 3600, integer: true, label: 'Voice max session seconds' },
  voiceMaxSessionsPerGuestPerDay: {
    min: 1,
    max: 999,
    integer: true,
    label: 'Voice sessions per guest per day',
  },
  voiceMaxConcurrentSessions: {
    min: 1,
    max: 50,
    integer: true,
    label: 'Voice concurrent sessions',
  },
  imageMonthlyCreditCap: { min: 1, integer: true, label: 'Image monthly credit cap' },
  videoMonthlyCreditCap: { min: 1, integer: true, label: 'Video monthly credit cap' },
};

export function isAiLimitKey(value: string): value is AiLimitKey {
  return (AI_LIMIT_KEYS as readonly string[]).includes(value);
}

/**
 * Validates a single limit value. `null` clears (inherit). Returns the normalized value or an error.
 */
export function parseAiLimitValue(
  key: AiLimitKey,
  raw: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === '') return { ok: true, value: null };
  const bounds = AI_LIMIT_BOUNDS[key];
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value)) return { ok: false, error: `${bounds.label} must be a number` };
  if (bounds.integer && !Number.isInteger(value)) {
    return { ok: false, error: `${bounds.label} must be a whole number` };
  }
  if (value < bounds.min || (bounds.max !== undefined && value > bounds.max)) {
    const range =
      bounds.max !== undefined
        ? `between ${bounds.min} and ${bounds.max}`
        : `at least ${bounds.min}`;
    return { ok: false, error: `${bounds.label} must be ${range}` };
  }
  return { ok: true, value };
}

/** Pure precedence walk: first layer with a non-null value for a key wins. */
export function resolveFromLayers(layers: AiLimitLayer[]): ResolvedAiLimits {
  const out = {} as ResolvedAiLimits;
  for (const key of AI_LIMIT_KEYS) {
    let resolved: ResolvedLimit | null = null;
    for (const layer of layers) {
      const value = layer.values[key];
      if (value !== null && value !== undefined) {
        resolved = { value, source: layer.source, profileCode: layer.profileCode ?? null };
        break;
      }
    }
    out[key] = resolved ?? { value: null, source: 'global', profileCode: null };
  }
  return out;
}

/** Number accessor for keys that are never null after a full org-scope resolve. */
export function limitNumber(limits: ResolvedAiLimits, key: AiLimitKey): number {
  const value = limits[key].value;
  if (value === null) {
    throw new Error(`AI limit ${key} did not resolve to a number`);
  }
  return value;
}

// ─── Short-lived memo ────────────────────────────────────────────────────────

/**
 * Every AI call resolves limits several times (gate, summary, usage record). A few-seconds memo
 * collapses those into one lookup per isolate. Writers clear it in-isolate; other isolates
 * pick changes up within `AI_LIMIT_CACHE_TTL_MS`.
 */
export const AI_LIMIT_CACHE_TTL_MS = 5_000;
const CACHE_MAX_ENTRIES = 500;
const limitCache = new Map<string, { at: number; value: Promise<unknown> }>();

export function withAiLimitCache<T>(
  key: string,
  load: () => Promise<T>,
  now: () => number = Date.now
): Promise<T> {
  const hit = limitCache.get(key);
  if (hit && now() - hit.at < AI_LIMIT_CACHE_TTL_MS) return hit.value as Promise<T>;
  if (limitCache.size >= CACHE_MAX_ENTRIES) limitCache.clear();
  const value = load().catch((error) => {
    limitCache.delete(key);
    throw error;
  });
  limitCache.set(key, { at: now(), value });
  return value;
}

export function clearAiLimitCache(): void {
  limitCache.clear();
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown> | null | undefined;

function num(row: Row, column: string): number | null {
  const raw = row?.[column];
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const PROFILE_COLUMNS: Record<AiLimitKey, string> = {
  dailyCallLimit: 'daily_call_limit',
  monthlyCallLimit: 'monthly_call_limit',
  dailyCostUsdLimit: 'daily_cost_usd_limit',
  dailyCreditLimit: 'daily_credit_limit',
  monthlyCreditLimit: 'monthly_credit_limit',
  assistantDailyMessageLimit: 'assistant_daily_message_limit',
  assistantMonthlyMessageLimit: 'assistant_monthly_message_limit',
  assistantDailyWriteActionLimit: 'assistant_daily_write_action_limit',
  voiceMaxSessionSeconds: 'voice_max_session_seconds',
  voiceMaxSessionsPerGuestPerDay: 'voice_max_sessions_per_guest_per_day',
  voiceMaxConcurrentSessions: 'voice_max_concurrent_sessions',
  imageMonthlyCreditCap: 'image_monthly_credit_cap',
  videoMonthlyCreditCap: 'video_monthly_credit_cap',
};

export const AI_LIMIT_PROFILE_COLUMNS: Record<AiLimitKey, string> = PROFILE_COLUMNS;
const PROFILE_SELECT = `id, code, name, description, is_default, updated_at, ${Object.values(PROFILE_COLUMNS).join(', ')}`;

export type AiLimitProfile = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  updatedAt: string | null;
  limits: Record<AiLimitKey, number | null>;
};

/** Dynamic select strings defeat supabase-js row inference; normalize once here. */
function profileRows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export function mapProfileRow(row: Record<string, unknown>): AiLimitProfile {
  const limits = {} as Record<AiLimitKey, number | null>;
  for (const key of AI_LIMIT_KEYS) limits[key] = num(row, PROFILE_COLUMNS[key]);
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    isDefault: row.is_default === true,
    updatedAt: (row.updated_at as string | null) ?? null,
    limits,
  };
}

function profileLayer(source: AiLimitSource, profile: AiLimitProfile | null): AiLimitLayer | null {
  return profile ? { source, profileCode: profile.code, values: profile.limits } : null;
}

/** Org settings row → override values. Only limit columns; `plan_credit_allowance` is its own layer. */
export function orgOverrideValues(orgRow: Row, assistantRow: Row): AiLimitValues {
  return {
    dailyCallLimit: num(orgRow, 'daily_call_limit'),
    monthlyCallLimit: num(orgRow, 'monthly_call_limit'),
    dailyCostUsdLimit: num(orgRow, 'daily_cost_usd_limit'),
    dailyCreditLimit: num(orgRow, 'daily_credit_limit'),
    monthlyCreditLimit: num(orgRow, 'monthly_credit_limit'),
    assistantDailyMessageLimit: num(assistantRow, 'daily_message_limit'),
    assistantMonthlyMessageLimit: num(assistantRow, 'monthly_message_limit'),
    assistantDailyWriteActionLimit: num(assistantRow, 'daily_write_action_limit'),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Property settings row (columns + `feature_configs` JSONB) → override values. */
export function propertyOverrideValues(propertyRow: Row): AiLimitValues {
  const configs = record(propertyRow?.feature_configs);
  const voice = record(configs.voice_receptionist);
  const image = record(configs.marketing_image_generate);
  const video = record(configs.marketing_video_generate);
  const positive = (v: unknown): number | null => {
    const n = Number(v);
    return v !== null && v !== undefined && Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    dailyCallLimit: num(propertyRow, 'daily_call_limit'),
    monthlyCallLimit: num(propertyRow, 'monthly_call_limit'),
    dailyCostUsdLimit: num(propertyRow, 'daily_cost_usd_limit'),
    dailyCreditLimit: num(propertyRow, 'daily_credit_limit'),
    monthlyCreditLimit: num(propertyRow, 'monthly_credit_limit'),
    voiceMaxSessionSeconds: positive(voice.max_session_seconds),
    voiceMaxSessionsPerGuestPerDay: positive(voice.max_sessions_per_guest_per_day),
    voiceMaxConcurrentSessions: positive(voice.max_concurrent_sessions),
    imageMonthlyCreditCap: positive(image.monthly_credit_cap),
    videoMonthlyCreditCap: positive(video.monthly_credit_cap),
  };
}

export type AiLimitGlobalDefaults = {
  defaultDailyCallLimit: number;
  defaultMonthlyCallLimit: number;
  defaultDailyCostUsdLimit: number;
  defaultDailyCreditLimit: number;
  defaultMonthlyCreditLimit: number;
};

export function globalLayer(global: AiLimitGlobalDefaults): AiLimitLayer {
  return {
    source: 'global',
    values: {
      ...AI_LIMIT_CONSTANT_DEFAULTS,
      dailyCallLimit: global.defaultDailyCallLimit,
      monthlyCallLimit: global.defaultMonthlyCallLimit,
      dailyCostUsdLimit: global.defaultDailyCostUsdLimit,
      dailyCreditLimit: global.defaultDailyCreditLimit,
      monthlyCreditLimit: global.defaultMonthlyCreditLimit,
    },
  };
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

export type AiLimitOrgInputs = {
  organizationId: string;
  global: AiLimitGlobalDefaults;
  orgRow: Row;
  assistantRow: Row;
  planTier: string;
  planAllowance: number | null;
  orgProfile: AiLimitProfile | null;
  planProfile: AiLimitProfile | null;
  defaultProfile: AiLimitProfile | null;
};

export function buildOrgLayers(input: AiLimitOrgInputs): AiLimitLayer[] {
  const layers: Array<AiLimitLayer | null> = [
    { source: 'override', values: orgOverrideValues(input.orgRow, input.assistantRow) },
    profileLayer('org', input.orgProfile),
    profileLayer('plan', input.planProfile),
    input.planAllowance === null
      ? null
      : { source: 'plan_allowance', values: { monthlyCreditLimit: input.planAllowance } },
    profileLayer('default', input.defaultProfile),
    globalLayer(input.global),
  ];
  return layers.filter((l): l is AiLimitLayer => l !== null);
}

export function buildPropertyLayers(
  input: AiLimitOrgInputs & {
    propertyRow: Row;
    propertyProfile: AiLimitProfile | null;
    developmentProfile: AiLimitProfile | null;
  }
): AiLimitLayer[] {
  const head: Array<AiLimitLayer | null> = [
    { source: 'override', values: propertyOverrideValues(input.propertyRow) },
    profileLayer('property', input.propertyProfile),
    profileLayer('development', input.developmentProfile),
  ];
  return [...head.filter((l): l is AiLimitLayer => l !== null), ...buildOrgLayers(input)];
}

async function loadGlobal(
  sb: ReturnType<typeof createServiceClient>
): Promise<AiLimitGlobalDefaults> {
  const { data, error } = await sb
    .from('ai_platform_global_settings')
    .select(
      'default_daily_call_limit, default_monthly_call_limit, default_daily_cost_usd_limit, default_daily_credit_limit, default_monthly_credit_limit'
    )
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    defaultDailyCallLimit: Number(data?.default_daily_call_limit ?? 200),
    defaultMonthlyCallLimit: Number(data?.default_monthly_call_limit ?? 5000),
    defaultDailyCostUsdLimit: Number(data?.default_daily_cost_usd_limit ?? 10),
    defaultDailyCreditLimit: Number(data?.default_daily_credit_limit ?? 100000),
    defaultMonthlyCreditLimit: Number(data?.default_monthly_credit_limit ?? 1000000),
  };
}

type AssignmentScope = 'organization' | 'property' | 'development';

async function loadProfilesByIds(
  sb: ReturnType<typeof createServiceClient>,
  ids: string[]
): Promise<Map<string, AiLimitProfile>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await sb
    .from('ai_limit_profiles')
    .select(PROFILE_SELECT)
    .in('id', unique);
  if (error) throw new Error(error.message);
  return new Map(profileRows(data).map((row) => [String(row.id), mapProfileRow(row)]));
}

async function loadAssignments(
  sb: ReturnType<typeof createServiceClient>,
  pairs: Array<{ scope: AssignmentScope; id: string | null }>
): Promise<Map<AssignmentScope, string>> {
  const wanted = pairs.filter((p): p is { scope: AssignmentScope; id: string } => Boolean(p.id));
  const out = new Map<AssignmentScope, string>();
  if (wanted.length === 0) return out;
  const { data, error } = await sb
    .from('ai_limit_assignments')
    .select('scope, scope_id, profile_id')
    .in(
      'scope_id',
      wanted.map((p) => p.id)
    );
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const match = wanted.find((p) => p.scope === row.scope && p.id === row.scope_id);
    if (match) out.set(match.scope, String(row.profile_id));
  }
  return out;
}

async function loadOrgInputs(
  sb: ReturnType<typeof createServiceClient>,
  organizationId: string,
  extraAssignments: Array<{ scope: AssignmentScope; id: string | null }> = []
) {
  const [global, orgRes, assistantRes, defaultRes] = await Promise.all([
    loadGlobal(sb),
    sb
      .from('ai_platform_org_settings')
      .select(
        'daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, plan_credit_allowance, plan_tier'
      )
      .eq('organization_id', organizationId)
      .maybeSingle(),
    sb
      .from('ai_dashboard_assistant_org_settings')
      .select('daily_message_limit, monthly_message_limit, daily_write_action_limit')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    sb.from('ai_limit_profiles').select(PROFILE_SELECT).eq('is_default', true).maybeSingle(),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (assistantRes.error) throw new Error(assistantRes.error.message);
  if (defaultRes.error) throw new Error(defaultRes.error.message);

  const planTier = String(orgRes.data?.plan_tier ?? 'included');
  const { data: planRow, error: planError } = await sb
    .from('pricing_plans')
    .select('ai_limit_profile_id')
    .eq('code', planTier)
    .maybeSingle();
  if (planError) throw new Error(planError.message);

  const assignments = await loadAssignments(sb, [
    { scope: 'organization', id: organizationId },
    ...extraAssignments,
  ]);
  const profiles = await loadProfilesByIds(sb, [
    ...(planRow?.ai_limit_profile_id ? [String(planRow.ai_limit_profile_id)] : []),
    ...Array.from(assignments.values()),
  ]);

  const orgProfileId = assignments.get('organization');
  const allowance = orgRes.data?.plan_credit_allowance;
  const inputs: AiLimitOrgInputs = {
    organizationId,
    global,
    orgRow: orgRes.data,
    assistantRow: assistantRes.data,
    planTier,
    planAllowance: allowance === null || allowance === undefined ? null : Number(allowance),
    orgProfile: orgProfileId ? (profiles.get(orgProfileId) ?? null) : null,
    planProfile: planRow?.ai_limit_profile_id
      ? (profiles.get(String(planRow.ai_limit_profile_id)) ?? null)
      : null,
    defaultProfile: defaultRes.data
      ? mapProfileRow(defaultRes.data as unknown as Record<string, unknown>)
      : null,
  };
  return { inputs, assignments, profiles };
}

export function resolveOrgAiLimits(organizationId: string): Promise<{
  limits: ResolvedAiLimits;
  planTier: string;
}> {
  return withAiLimitCache(`org:${organizationId}`, async () => {
    const sb = createServiceClient();
    const { inputs } = await loadOrgInputs(sb, organizationId);
    return { limits: resolveFromLayers(buildOrgLayers(inputs)), planTier: inputs.planTier };
  });
}

export function resolvePropertyAiLimits(
  organizationId: string,
  propertyId: string
): Promise<{ limits: ResolvedAiLimits; planTier: string }> {
  return withAiLimitCache(`property:${organizationId}:${propertyId}`, () =>
    loadPropertyAiLimits(organizationId, propertyId)
  );
}

async function loadPropertyAiLimits(
  organizationId: string,
  propertyId: string
): Promise<{ limits: ResolvedAiLimits; planTier: string }> {
  const sb = createServiceClient();
  const [{ data: property, error: propertyError }, { data: propertyRow, error: rowError }] =
    await Promise.all([
      sb.from('properties').select('residence_name').eq('id', propertyId).maybeSingle(),
      sb
        .from('ai_platform_property_settings')
        .select(
          'daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, feature_configs'
        )
        .eq('property_id', propertyId)
        .maybeSingle(),
    ]);
  if (propertyError) throw new Error(propertyError.message);
  if (rowError) throw new Error(rowError.message);

  let developmentId: string | null = null;
  const residence = (property?.residence_name as string | null)?.trim();
  if (residence) {
    const { data: development, error: developmentError } = await sb
      .from('developments')
      .select('id')
      .eq('name', residence)
      .maybeSingle();
    if (developmentError) throw new Error(developmentError.message);
    developmentId = development?.id ? String(development.id) : null;
  }

  const { inputs, assignments, profiles } = await loadOrgInputs(sb, organizationId, [
    { scope: 'property', id: propertyId },
    { scope: 'development', id: developmentId },
  ]);
  const propertyProfileId = assignments.get('property');
  const developmentProfileId = assignments.get('development');
  const layers = buildPropertyLayers({
    ...inputs,
    propertyRow,
    propertyProfile: propertyProfileId ? (profiles.get(propertyProfileId) ?? null) : null,
    developmentProfile: developmentProfileId ? (profiles.get(developmentProfileId) ?? null) : null,
  });
  return { limits: resolveFromLayers(layers), planTier: inputs.planTier };
}

/** Profile catalog helpers used by the super-admin console. */
export async function listAiLimitProfiles(): Promise<AiLimitProfile[]> {
  const { data, error } = await createServiceClient()
    .from('ai_limit_profiles')
    .select(PROFILE_SELECT)
    .order('is_default', { ascending: false })
    .order('code', { ascending: true });
  if (error) throw new Error(error.message);
  return profileRows(data).map(mapProfileRow);
}

export type ResolvedOrgAiLimits = {
  limits: ResolvedAiLimits;
  planTier: string;
  /** Code of the profile assigned directly to the org, if any. */
  orgProfileCode: string | null;
  /** Code of the plan-tier profile the org's plan is bound to, if any. */
  planProfileCode: string | null;
  /** True when the org row holds a non-null override the console should flag. */
  hasOverrides: boolean;
  overrideReason: string | null;
};

const BATCH_CHUNK = 100;

/**
 * Resolves many orgs with a fixed number of queries (super-admin matrix, usage tables).
 * Same layering as `resolveOrgAiLimits`, built from the shared pure functions.
 */
export async function resolveOrgAiLimitsBatch(
  organizationIds: string[]
): Promise<Map<string, ResolvedOrgAiLimits>> {
  const ids = Array.from(new Set(organizationIds.filter(Boolean)));
  const out = new Map<string, ResolvedOrgAiLimits>();
  if (ids.length === 0) return out;

  const sb = createServiceClient();
  const [global, plansRes, profilesRes] = await Promise.all([
    loadGlobal(sb),
    sb.from('pricing_plans').select('code, ai_limit_profile_id'),
    sb.from('ai_limit_profiles').select(PROFILE_SELECT),
  ]);
  if (plansRes.error) throw new Error(plansRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const profiles = new Map(
    profileRows(profilesRes.data).map((row) => {
      const profile = mapProfileRow(row);
      return [profile.id, profile] as const;
    })
  );
  const defaultProfile = Array.from(profiles.values()).find((p) => p.isDefault) ?? null;
  const planProfileByCode = new Map(
    (plansRes.data ?? []).map((row) => [
      String(row.code),
      row.ai_limit_profile_id ? (profiles.get(String(row.ai_limit_profile_id)) ?? null) : null,
    ])
  );

  for (let i = 0; i < ids.length; i += BATCH_CHUNK) {
    const chunk = ids.slice(i, i + BATCH_CHUNK);
    const [orgRes, assistantRes, assignRes] = await Promise.all([
      sb
        .from('ai_platform_org_settings')
        .select(
          'organization_id, daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, plan_credit_allowance, plan_tier, override_reason'
        )
        .in('organization_id', chunk),
      sb
        .from('ai_dashboard_assistant_org_settings')
        .select(
          'organization_id, daily_message_limit, monthly_message_limit, daily_write_action_limit'
        )
        .in('organization_id', chunk),
      sb
        .from('ai_limit_assignments')
        .select('scope_id, profile_id')
        .eq('scope', 'organization')
        .in('scope_id', chunk),
    ]);
    if (orgRes.error) throw new Error(orgRes.error.message);
    if (assistantRes.error) throw new Error(assistantRes.error.message);
    if (assignRes.error) throw new Error(assignRes.error.message);

    const orgRows = new Map((orgRes.data ?? []).map((r) => [String(r.organization_id), r]));
    const assistantRows = new Map(
      (assistantRes.data ?? []).map((r) => [String(r.organization_id), r])
    );
    const assignments = new Map(
      (assignRes.data ?? []).map((r) => [String(r.scope_id), String(r.profile_id)])
    );

    for (const organizationId of chunk) {
      const orgRow = orgRows.get(organizationId) ?? null;
      const assistantRow = assistantRows.get(organizationId) ?? null;
      const planTier = String(orgRow?.plan_tier ?? 'included');
      const allowance = orgRow?.plan_credit_allowance;
      const orgProfileId = assignments.get(organizationId);
      const orgProfile = orgProfileId ? (profiles.get(orgProfileId) ?? null) : null;
      const planProfile = planProfileByCode.get(planTier) ?? null;
      const layers = buildOrgLayers({
        organizationId,
        global,
        orgRow,
        assistantRow,
        planTier,
        planAllowance: allowance === null || allowance === undefined ? null : Number(allowance),
        orgProfile,
        planProfile,
        defaultProfile,
      });
      const overrides = orgOverrideValues(orgRow, assistantRow);
      out.set(organizationId, {
        limits: resolveFromLayers(layers),
        planTier,
        orgProfileCode: orgProfile?.code ?? null,
        planProfileCode: planProfile?.code ?? null,
        hasOverrides: AI_LIMIT_KEYS.some((key) => overrides[key] != null),
        overrideReason: (orgRow?.override_reason as string | null) ?? null,
      });
    }
  }
  return out;
}

export type ResolvedPropertyAiLimits = {
  propertyId: string;
  name: string;
  slug: string;
  residenceName: string | null;
  /** Profile assigned directly to the property, if any. */
  propertyProfileCode: string | null;
  /** Profile assigned to the property's development, if any. */
  developmentProfileCode: string | null;
  limits: ResolvedAiLimits;
};

/**
 * Resolves every property of one org with a fixed number of queries (super-admin org detail),
 * instead of N calls to `resolvePropertyAiLimits`.
 */
export async function resolveOrgPropertiesAiLimits(
  organizationId: string
): Promise<ResolvedPropertyAiLimits[]> {
  const sb = createServiceClient();
  const [{ inputs }, propsRes, devsRes, assignRes, profileList] = await Promise.all([
    loadOrgInputs(sb, organizationId),
    sb
      .from('properties')
      .select('id, name, slug, residence_name')
      .eq('organization_id', organizationId)
      .order('name')
      .limit(200),
    sb.from('developments').select('id, name'),
    sb
      .from('ai_limit_assignments')
      .select('scope, scope_id, profile_id')
      .neq('scope', 'organization'),
    listAiLimitProfiles(),
  ]);
  if (propsRes.error) throw new Error(propsRes.error.message);
  if (devsRes.error) throw new Error(devsRes.error.message);
  if (assignRes.error) throw new Error(assignRes.error.message);

  const properties = propsRes.data ?? [];
  const propertyIds = properties.map((p) => String(p.id));
  const settingsRes =
    propertyIds.length === 0
      ? { data: [], error: null }
      : await sb
          .from('ai_platform_property_settings')
          .select(
            'property_id, daily_call_limit, monthly_call_limit, daily_cost_usd_limit, daily_credit_limit, monthly_credit_limit, feature_configs'
          )
          .in('property_id', propertyIds);
  if (settingsRes.error) throw new Error(settingsRes.error.message);

  const profilesById = new Map(profileList.map((p) => [p.id, p]));
  const settingsByProperty = new Map(
    (settingsRes.data ?? []).map((r) => [String(r.property_id), r])
  );
  const devIdByName = new Map((devsRes.data ?? []).map((d) => [String(d.name), String(d.id)]));
  const assignmentProfile = (scope: string, id: string | null) => {
    if (!id) return null;
    const row = (assignRes.data ?? []).find((a) => a.scope === scope && a.scope_id === id);
    return row ? (profilesById.get(String(row.profile_id)) ?? null) : null;
  };

  return properties.map((p) => {
    const propertyId = String(p.id);
    const residence = (p.residence_name as string | null)?.trim() || null;
    const propertyProfile = assignmentProfile('property', propertyId);
    const developmentProfile = assignmentProfile(
      'development',
      residence ? (devIdByName.get(residence) ?? null) : null
    );
    const layers = buildPropertyLayers({
      ...inputs,
      propertyRow: settingsByProperty.get(propertyId) ?? null,
      propertyProfile,
      developmentProfile,
    });
    return {
      propertyId,
      name: String(p.name),
      slug: String(p.slug),
      residenceName: residence,
      propertyProfileCode: propertyProfile?.code ?? null,
      developmentProfileCode: developmentProfile?.code ?? null,
      limits: resolveFromLayers(layers),
    };
  });
}
