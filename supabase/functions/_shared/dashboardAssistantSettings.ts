/**
 * Kill-switch config + quota metering for the AI dashboard assistant.
 * Independent of the ai_platform_* tables / aiUsageService.ts (Phase A) — own tables, own soft-cap quota.
 * Docs: docs/workflow/planned/ai-dashboard-assistant.md §1 step 2-3, §4, §6.
 */

import {
  clearAiLimitCache,
  limitNumber,
  resolveOrgAiLimits,
  type ResolvedAiLimits,
} from './aiLimitResolver.ts';
import { createServiceClient } from './orgAuth.ts';

export type DashboardAssistantGlobalSettings = {
  enabled: boolean;
  /** Full-page AI chat mode (docs/workflow/in-progress/ai-chat-mode.md). Needs `enabled` too. */
  aiModeEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
};

export type DashboardAssistantOrgSettings = {
  organizationId: string;
  enabled: boolean;
  disabledPropertyIds: string[];
  dailyMessageLimit: number;
  monthlyMessageLimit: number;
  dailyWriteActionLimit: number;
  overrideReason: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

export async function getDashboardAssistantGlobalSettings(): Promise<DashboardAssistantGlobalSettings> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('ai_dashboard_assistant_global_settings')
    .select('enabled, ai_mode_enabled, updated_by, updated_at')
    .eq('id', true)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load dashboard assistant global settings: ${error.message}`);
  }
  return {
    enabled: Boolean(data?.enabled),
    aiModeEnabled: Boolean(data?.ai_mode_enabled),
    updatedBy: (data?.updated_by as string | null) ?? null,
    updatedAt: (data?.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function setDashboardAssistantGlobalSettings(input: {
  enabled?: boolean;
  aiModeEnabled?: boolean;
  updatedBy: string;
}): Promise<DashboardAssistantGlobalSettings> {
  const sb = createServiceClient();
  const patch: Record<string, unknown> = {
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  };
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.aiModeEnabled !== undefined) patch.ai_mode_enabled = input.aiModeEnabled;

  const { data, error } = await sb
    .from('ai_dashboard_assistant_global_settings')
    .update(patch)
    .eq('id', true)
    .select('enabled, ai_mode_enabled, updated_by, updated_at')
    .single();
  if (error) {
    throw new Error(`Failed to update dashboard assistant global settings: ${error.message}`);
  }
  return {
    enabled: Boolean(data.enabled),
    aiModeEnabled: Boolean(data.ai_mode_enabled),
    updatedBy: (data.updated_by as string | null) ?? null,
    updatedAt: data.updated_at as string,
  };
}

function mapOrgSettingsRow(
  organizationId: string,
  row: Record<string, unknown> | null,
  limits: ResolvedAiLimits
): DashboardAssistantOrgSettings {
  return {
    organizationId,
    enabled: Boolean(row?.enabled),
    disabledPropertyIds: ((row?.disabled_property_ids as string[] | null) ?? []) as string[],
    dailyMessageLimit: limitNumber(limits, 'assistantDailyMessageLimit'),
    monthlyMessageLimit: limitNumber(limits, 'assistantMonthlyMessageLimit'),
    dailyWriteActionLimit: limitNumber(limits, 'assistantDailyWriteActionLimit'),
    overrideReason: (row?.override_reason as string | null) ?? null,
    updatedBy: (row?.updated_by as string | null) ?? null,
    updatedAt: (row?.updated_at as string) ?? new Date().toISOString(),
  };
}

/** Effective limits come from aiLimitResolver; hosts only own `enabled` + `disabledPropertyIds`. */
export async function getDashboardAssistantOrgSettings(
  organizationId: string
): Promise<DashboardAssistantOrgSettings> {
  const sb = createServiceClient();
  const [rowRes, { limits }] = await Promise.all([
    sb
      .from('ai_dashboard_assistant_org_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    resolveOrgAiLimits(organizationId),
  ]);
  if (rowRes.error) {
    throw new Error(`Failed to load dashboard assistant org settings: ${rowRes.error.message}`);
  }
  return mapOrgSettingsRow(organizationId, rowRes.data, limits);
}

/**
 * Host callers pass `enabled` / `disabledPropertyIds` only. Limit fields are super-admin writes
 * (`null` clears the override so the profile chain applies again).
 */
export async function upsertDashboardAssistantOrgSettings(input: {
  organizationId: string;
  enabled?: boolean;
  disabledPropertyIds?: string[];
  dailyMessageLimit?: number | null;
  monthlyMessageLimit?: number | null;
  dailyWriteActionLimit?: number | null;
  overrideReason?: string | null;
  updatedBy: string;
}): Promise<DashboardAssistantOrgSettings> {
  const sb = createServiceClient();
  const patch: Record<string, unknown> = {
    organization_id: input.organizationId,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  };
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.disabledPropertyIds !== undefined)
    patch.disabled_property_ids = input.disabledPropertyIds;
  if (input.dailyMessageLimit !== undefined) patch.daily_message_limit = input.dailyMessageLimit;
  if (input.monthlyMessageLimit !== undefined)
    patch.monthly_message_limit = input.monthlyMessageLimit;
  if (input.dailyWriteActionLimit !== undefined)
    patch.daily_write_action_limit = input.dailyWriteActionLimit;
  if (input.overrideReason !== undefined) {
    patch.override_reason = input.overrideReason;
    patch.overridden_by = input.overrideReason === null ? null : input.updatedBy;
  }

  const { error } = await sb
    .from('ai_dashboard_assistant_org_settings')
    .upsert(patch, { onConflict: 'organization_id' });
  if (error) {
    throw new Error(`Failed to update dashboard assistant org settings: ${error.message}`);
  }
  clearAiLimitCache();
  return getDashboardAssistantOrgSettings(input.organizationId);
}

// ─── Quota (soft cap, no billing wiring — see plan's explicit non-goals) ────

export type DashboardAssistantQuotaCheck = {
  allowed: boolean;
  reason: 'ok' | 'daily_limit' | 'monthly_limit';
  messageCountToday: number;
  dailyMessageLimit: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  return `${todayIso().slice(0, 7)}-01`;
}

/**
 * Message/day and message/month spam-abuse guard (prevents burst chat-turn spam) — NOT the
 * billing-relevant limit. The authoritative, billing-relevant check is the shared
 * `ai_platform_*` credit/cost quota (`assertOrgAndPropertyAiQuota` in aiUsageService.ts),
 * already invoked every round by the AI gateway (`_shared/ai/llmTools.ts`). This function's counts are a
 * cheap pre-check that runs before the tool-calling loop starts, independent of it.
 */
export async function checkDashboardAssistantQuota(
  organizationId: string,
  orgSettings: DashboardAssistantOrgSettings
): Promise<DashboardAssistantQuotaCheck> {
  const sb = createServiceClient();
  const today = todayIso();

  const { data: todayRow } = await sb
    .from('ai_dashboard_assistant_usage_daily')
    .select('message_count')
    .eq('organization_id', organizationId)
    .eq('usage_date', today)
    .maybeSingle();
  const messageCountToday = Number(todayRow?.message_count ?? 0);

  if (messageCountToday >= orgSettings.dailyMessageLimit) {
    return {
      allowed: false,
      reason: 'daily_limit',
      messageCountToday,
      dailyMessageLimit: orgSettings.dailyMessageLimit,
    };
  }

  const { data: monthRows } = await sb
    .from('ai_dashboard_assistant_usage_daily')
    .select('message_count')
    .eq('organization_id', organizationId)
    .gte('usage_date', monthStartIso())
    .lte('usage_date', today);
  const messageCountMonth = (monthRows ?? []).reduce(
    (sum, r) => sum + Number(r.message_count ?? 0),
    0
  );

  if (messageCountMonth >= orgSettings.monthlyMessageLimit) {
    return {
      allowed: false,
      reason: 'monthly_limit',
      messageCountToday,
      dailyMessageLimit: orgSettings.dailyMessageLimit,
    };
  }

  return {
    allowed: true,
    reason: 'ok',
    messageCountToday,
    dailyMessageLimit: orgSettings.dailyMessageLimit,
  };
}

/** Atomic counter increment (single upsert RPC — no lost counts under concurrent turns). */
export async function incrementDashboardAssistantUsage(
  organizationId: string,
  input: { message?: boolean; writeAction?: boolean; creditsConsumed?: number }
): Promise<void> {
  const { error } = await createServiceClient().rpc(
    'increment_ai_dashboard_assistant_usage_daily',
    {
      p_organization_id: organizationId,
      p_usage_date: todayIso(),
      p_messages: input.message ? 1 : 0,
      p_write_actions: input.writeAction ? 1 : 0,
      p_credits: input.creditsConsumed ?? 0,
    }
  );
  if (error) {
    console.error('[dashboardAssistantSettings] usage increment failed:', error.message);
  }
}

/**
 * Daily cap on assistant-executed writes (org setting `daily_write_action_limit`). Checked before
 * any write runs — confirmed Tier-2 actions and committed Tier-1 writes alike.
 */
export async function remainingDashboardAssistantWrites(
  organizationId: string,
  orgSettings: DashboardAssistantOrgSettings
): Promise<number> {
  const { data } = await createServiceClient()
    .from('ai_dashboard_assistant_usage_daily')
    .select('write_action_count')
    .eq('organization_id', organizationId)
    .eq('usage_date', todayIso())
    .maybeSingle();
  return Math.max(0, orgSettings.dailyWriteActionLimit - Number(data?.write_action_count ?? 0));
}

export const DASHBOARD_ASSISTANT_WRITE_LIMIT_MESSAGE =
  "You've reached today's limit for changes made through the assistant. Make this change in the dashboard, or try again tomorrow.";

export type DashboardAssistantUsageSummary = {
  todayMessageCount: number;
  monthMessageCount: number;
  todayWriteActionCount: number;
  monthWriteActionCount: number;
  todayCreditsConsumed: number;
  monthCreditsConsumed: number;
};

/** Informational read for the org settings page — not used for any gating decision. */
export async function getDashboardAssistantUsageSummary(
  organizationId: string
): Promise<DashboardAssistantUsageSummary> {
  const sb = createServiceClient();
  const today = todayIso();

  const { data: todayRow } = await sb
    .from('ai_dashboard_assistant_usage_daily')
    .select('message_count, write_action_count, credits_consumed')
    .eq('organization_id', organizationId)
    .eq('usage_date', today)
    .maybeSingle();

  const { data: monthRows } = await sb
    .from('ai_dashboard_assistant_usage_daily')
    .select('message_count, write_action_count, credits_consumed')
    .eq('organization_id', organizationId)
    .gte('usage_date', monthStartIso())
    .lte('usage_date', today);

  const monthTotals = (monthRows ?? []).reduce(
    (acc, row) => ({
      messageCount: acc.messageCount + Number(row.message_count ?? 0),
      writeActionCount: acc.writeActionCount + Number(row.write_action_count ?? 0),
      creditsConsumed: acc.creditsConsumed + Number(row.credits_consumed ?? 0),
    }),
    { messageCount: 0, writeActionCount: 0, creditsConsumed: 0 }
  );

  return {
    todayMessageCount: Number(todayRow?.message_count ?? 0),
    monthMessageCount: monthTotals.messageCount,
    todayWriteActionCount: Number(todayRow?.write_action_count ?? 0),
    monthWriteActionCount: monthTotals.writeActionCount,
    todayCreditsConsumed: Number(todayRow?.credits_consumed ?? 0),
    monthCreditsConsumed: monthTotals.creditsConsumed,
  };
}

/** True only when both kill-switch layers are on and this property (if any) isn't opted out. */
export function isDashboardAssistantAccessible(
  global: DashboardAssistantGlobalSettings,
  org: DashboardAssistantOrgSettings,
  propertyId?: string | null
): boolean {
  if (!global.enabled) return false;
  if (!org.enabled) return false;
  if (propertyId && org.disabledPropertyIds.includes(propertyId)) return false;
  return true;
}
