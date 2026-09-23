/**
 * AI Voice Receptionist — global kill switch, per-property settings, and session caps.
 * Mirrors the social_inbox_settings ensure/get/patch pattern.
 *
 * Cost note: session cost is a per-minute estimate (`cost_basis: 'duration'`), not real
 * Gemini Live billing — see the quarterly reconciliation process documented on
 * `endVoiceReceptionistSession()` below.
 */

import { createServiceClient } from './orgAuth.ts';
import { GEMINI_LIVE_VOICES, type GeminiLiveVoice } from './geminiLiveEphemeral.ts';
import { getModelConfig, isValidAiFeature } from './aiModelRouter.ts';
import { getAiPlatformGlobalSettings, recordAiUsage } from './aiUsageService.ts';

const MANILA_TZ = 'Asia/Manila';
const VOICE_FEATURE = 'voice_receptionist' as const;

/**
 * Rough Gemini Live native-audio blended rate (input $0.005/min + output $0.018/min,
 * published per-minute equivalents as of this writing) applied to wall-clock duration.
 * Actual billing is token-based and re-bills prior turns each round-trip, so real cost is
 * higher for longer conversations — this is a visibility estimate, not an invoice figure.
 * Default only — the live value is configurable via
 * ai_platform_global_settings.voice_receptionist_cost_per_minute_usd (super-admin only);
 * see quarterly reconciliation note on endVoiceReceptionistSession() below.
 */
const FALLBACK_ESTIMATED_COST_PER_MINUTE_USD = 0.023;

export type VoiceReceptionistGlobalSettingsDto = {
  enabled: boolean;
  rolloutPercentage: number;
  rolloutPropertyIds: string[];
  healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  healthCheckedAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

export type VoiceReceptionistSettingsDto = {
  propertyId: string;
  enabled: boolean;
  voiceId: string;
  personaPrompt: string | null;
  maxSessionSeconds: number;
  maxSessionsPerGuestPerDay: number;
  maxConcurrentSessions: number;
  availableVoices: readonly string[];
};

export type VoiceReceptionistClientMetrics = {
  setupMs: number | null;
  firstAudioMs: number | null;
  reconnectCount: number;
};

function boundedClientMetric(value: unknown, maximum: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(0, Math.round(value)));
}

export function sanitizeVoiceReceptionistClientMetrics(
  value: unknown
): VoiceReceptionistClientMetrics {
  const metrics =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    setupMs: boundedClientMetric(metrics.setupMs, 600_000),
    firstAudioMs: boundedClientMetric(metrics.firstAudioMs, 600_000),
    reconnectCount: boundedClientMetric(metrics.reconnectCount, 100) ?? 0,
  };
}

export class VoiceReceptionistCapError extends Error {
  constructor(
    message: string,
    public readonly code: 'guest_daily_cap' | 'concurrent_cap'
  ) {
    super(message);
    this.name = 'VoiceReceptionistCapError';
  }
}

export async function recordVoiceReceptionistStartAttempt(input: {
  propertyId: string;
  guestUserId: string;
  outcome: 'started' | 'provider_failed' | 'cap_denied' | 'gate_denied';
  failureCode?: string | null;
  reservationLatencyMs?: number | null;
  mintLatencyMs?: number | null;
}): Promise<void> {
  const { error } = await db()
    .from('voice_receptionist_start_attempts')
    .insert({
      property_id: input.propertyId,
      guest_user_id: input.guestUserId,
      outcome: input.outcome,
      failure_code: input.failureCode ?? null,
      reservation_latency_ms: input.reservationLatencyMs ?? null,
      mint_latency_ms: input.mintLatencyMs ?? null,
    });
  if (error) {
    console.warn('[voiceReceptionistService] start-attempt record failed:', error.message);
  }
}

export async function recordVoiceReceptionistProviderFailure(failureCode: string): Promise<void> {
  const { error } = await db()
    .from('ai_platform_global_settings')
    .update({
      voice_receptionist_health_status: 'unhealthy',
      voice_receptionist_health_checked_at: new Date().toISOString(),
      voice_receptionist_health_failure_code: failureCode.slice(0, 120),
    })
    .eq('id', 1);
  if (error) {
    console.warn('[voiceReceptionistService] provider failure health:', error.message);
  }
}

export async function recordVoiceReceptionistToolMetric(input: {
  sessionId: string;
  toolName: string;
  durationMs: number;
  outcome: 'success' | 'failed';
}): Promise<void> {
  const { error } = await db()
    .from('voice_receptionist_tool_metrics')
    .insert({
      session_id: input.sessionId,
      tool_name: input.toolName.slice(0, 80),
      duration_ms: Math.min(600_000, Math.max(0, Math.round(input.durationMs))),
      outcome: input.outcome,
    });
  if (error) {
    console.warn('[voiceReceptionistService] tool metric failed:', error.message);
  }
}

export async function storeVoiceReceptionistClientMetrics(
  sessionId: string,
  guestUserId: string,
  metrics: VoiceReceptionistClientMetrics
): Promise<void> {
  const { error } = await db()
    .from('voice_receptionist_sessions')
    .update({
      client_setup_ms: metrics.setupMs,
      client_first_audio_ms: metrics.firstAudioMs,
      reconnect_count: metrics.reconnectCount,
    })
    .eq('id', sessionId)
    .eq('guest_user_id', guestUserId);
  if (error) {
    console.warn('[voiceReceptionistService] client metric failed:', error.message);
  }
}

export async function getVoiceReceptionistOperationalMetrics(days = 7): Promise<unknown> {
  const boundedDays = Math.min(30, Math.max(1, Math.round(days)));
  const sb = db();
  const [metricsResult, mintAlertResult] = await Promise.all([
    sb.rpc('get_voice_receptionist_operational_metrics', { p_days: boundedDays }),
    sb.rpc('is_voice_receptionist_mint_failure_rate_high', { p_days: boundedDays }),
  ]);
  if (metricsResult.error) {
    console.warn(
      '[voiceReceptionistService] operational metrics failed:',
      metricsResult.error.message
    );
    return null;
  }
  if (mintAlertResult.error) {
    console.warn(
      '[voiceReceptionistService] mint alert metric failed:',
      mintAlertResult.error.message
    );
  }
  const metrics =
    metricsResult.data && typeof metricsResult.data === 'object'
      ? (metricsResult.data as Record<string, unknown>)
      : {};
  const alerts =
    metrics.alerts && typeof metrics.alerts === 'object'
      ? (metrics.alerts as Record<string, unknown>)
      : {};
  return {
    ...metrics,
    alerts: {
      ...alerts,
      mintFailureRateHigh: mintAlertResult.data === true,
    },
  };
}

function db() {
  return createServiceClient();
}

async function getOrganizationIdForProperty(propertyId: string): Promise<string> {
  const sb = db();
  const { data, error } = await sb
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) {
    console.error('[voiceReceptionistService] lookup property org:', error.message);
    throw new Error('Failed to load voice receptionist settings');
  }
  if (!data?.organization_id) {
    throw new Error('Property not found');
  }
  return data.organization_id as string;
}

export async function getGlobalVoiceReceptionistSettings(): Promise<VoiceReceptionistGlobalSettingsDto> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_global_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('[voiceReceptionistService] load global settings:', error.message);
    throw new Error('Failed to load global voice receptionist settings');
  }
  const globalEnabled = data?.enabled ?? false;
  const allowedFeatures = (data?.allowed_features as string[] | undefined) ?? [];
  const allowed =
    globalEnabled && (allowedFeatures.length === 0 || allowedFeatures.includes(VOICE_FEATURE));
  return {
    enabled: allowed,
    rolloutPercentage: Math.min(
      100,
      Math.max(0, Number(data?.voice_receptionist_rollout_percentage ?? 0))
    ),
    rolloutPropertyIds: Array.isArray(data?.voice_receptionist_rollout_property_ids)
      ? (data.voice_receptionist_rollout_property_ids as string[])
      : [],
    healthStatus:
      data?.voice_receptionist_health_status === 'healthy' ||
      data?.voice_receptionist_health_status === 'unhealthy'
        ? data.voice_receptionist_health_status
        : 'unknown',
    healthCheckedAt:
      (data?.voice_receptionist_health_checked_at as string | null | undefined) ?? null,
    updatedBy: (data?.updated_by as string | null) ?? null,
    updatedAt: (data?.updated_at as string | undefined) ?? new Date().toISOString(),
  };
}

export function isVoiceReceptionistCircuitOpen(
  settings: VoiceReceptionistGlobalSettingsDto,
  nowMs = Date.now()
): boolean {
  if (settings.healthStatus !== 'unhealthy' || !settings.healthCheckedAt) return false;
  const checkedAtMs = new Date(settings.healthCheckedAt).getTime();
  return Number.isFinite(checkedAtMs) && nowMs - checkedAtMs < 5 * 60_000;
}

export function isPropertyInVoiceReceptionistRollout(
  propertyId: string,
  settings: VoiceReceptionistGlobalSettingsDto
): boolean {
  if (!settings.enabled) return false;
  if (settings.rolloutPropertyIds.includes(propertyId)) return true;
  if (settings.rolloutPercentage >= 100) return true;
  if (settings.rolloutPercentage <= 0) return false;
  const normalized = propertyId.replaceAll('-', '').slice(0, 8);
  const bucket = Number.parseInt(normalized, 16) % 100;
  return bucket < settings.rolloutPercentage;
}

export function evaluateVoiceReceptionistGlobalGate(
  propertyId: string,
  settings: VoiceReceptionistGlobalSettingsDto,
  nowMs = Date.now()
): 'platform_disabled' | 'rollout_denied' | 'provider_unhealthy' | null {
  if (!settings.enabled) return 'platform_disabled';
  if (!isPropertyInVoiceReceptionistRollout(propertyId, settings)) return 'rollout_denied';
  if (isVoiceReceptionistCircuitOpen(settings, nowMs)) return 'provider_unhealthy';
  return null;
}

export function resolveVoiceReceptionistSessionBudget(
  configuredMaxSeconds: number,
  dailyCostRemaining: number
): { effectiveMaxSeconds: number; denialCode: 'daily_cost_limit' | null } {
  if (dailyCostRemaining <= 0) {
    return { effectiveMaxSeconds: 0, denialCode: 'daily_cost_limit' };
  }
  let effectiveMaxSeconds = Math.min(configuredMaxSeconds, 9 * 60);
  if (dailyCostRemaining < 1) {
    effectiveMaxSeconds = Math.min(effectiveMaxSeconds, 90);
  } else if (dailyCostRemaining < 3) {
    effectiveMaxSeconds = Math.min(effectiveMaxSeconds, 180);
  }
  return { effectiveMaxSeconds, denialCode: null };
}

type VoiceFeatureConfig = {
  enabled?: boolean;
  voiceId?: string;
  personaPrompt?: string | null;
  maxSessionSeconds?: number;
  maxSessionsPerGuestPerDay?: number;
  maxConcurrentSessions?: number;
};

function getVoiceFeatureConfig(row: Record<string, unknown> | null): VoiceFeatureConfig {
  const configs = (row?.feature_configs as Record<string, unknown> | undefined) ?? {};
  const config = configs[VOICE_FEATURE] as Record<string, unknown> | undefined;
  return {
    enabled: config?.enabled as boolean | undefined,
    voiceId: config?.voice_id as string | undefined,
    personaPrompt: config?.persona_prompt as string | null | undefined,
    maxSessionSeconds: config?.max_session_seconds as number | undefined,
    maxSessionsPerGuestPerDay: config?.max_sessions_per_guest_per_day as number | undefined,
    maxConcurrentSessions: config?.max_concurrent_sessions as number | undefined,
  };
}

function serializeSettingsRow(
  propertyId: string,
  row: Record<string, unknown> | null
): VoiceReceptionistSettingsDto {
  const config = getVoiceFeatureConfig(row);
  const rowEnabled = row?.enabled as boolean | undefined;
  return {
    propertyId,
    enabled: rowEnabled !== false && (config.enabled ?? false),
    voiceId: config.voiceId ?? 'Kore',
    personaPrompt: config.personaPrompt ?? null,
    maxSessionSeconds: config.maxSessionSeconds ?? 300,
    maxSessionsPerGuestPerDay: config.maxSessionsPerGuestPerDay ?? 3,
    maxConcurrentSessions: config.maxConcurrentSessions ?? 3,
    availableVoices: GEMINI_LIVE_VOICES,
  };
}

async function ensureVoiceReceptionistSettingsRow(
  propertyId: string,
  organizationId: string
): Promise<void> {
  const sb = db();
  const { error } = await sb
    .from('ai_platform_property_settings')
    .upsert(
      { property_id: propertyId, organization_id: organizationId, feature_configs: {} },
      { onConflict: 'property_id', ignoreDuplicates: true }
    );
  if (error) {
    console.error('[voiceReceptionistService] ensure property settings row:', error.message);
    throw new Error('Failed to load voice receptionist settings');
  }
}

export async function getVoiceReceptionistSettings(
  propertyId: string
): Promise<VoiceReceptionistSettingsDto> {
  const organizationId = await getOrganizationIdForProperty(propertyId);
  await ensureVoiceReceptionistSettingsRow(propertyId, organizationId);
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_property_settings')
    .select('*')
    .eq('property_id', propertyId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) {
    console.error('[voiceReceptionistService] load property settings:', error.message);
    throw new Error('Failed to load voice receptionist settings');
  }
  return serializeSettingsRow(propertyId, data);
}

export type VoiceReceptionistSettingsPatch = {
  enabled?: boolean;
  voiceId?: string;
  personaPrompt?: string | null;
  maxSessionSeconds?: number;
  maxSessionsPerGuestPerDay?: number;
  maxConcurrentSessions?: number;
};

function isPositiveInt(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
  );
}

export function validateVoiceReceptionistPatch(body: Record<string, unknown>): {
  patch: VoiceReceptionistSettingsPatch;
  error: string | null;
} {
  const patch: VoiceReceptionistSettingsPatch = {};

  if (body.enabled !== undefined) {
    patch.enabled = Boolean(body.enabled);
  }
  if (body.voiceId !== undefined) {
    const voiceId = String(body.voiceId ?? '').trim();
    if (!GEMINI_LIVE_VOICES.includes(voiceId as GeminiLiveVoice)) {
      return { patch, error: `voiceId must be one of: ${GEMINI_LIVE_VOICES.join(', ')}` };
    }
    patch.voiceId = voiceId;
  }
  if (body.personaPrompt !== undefined) {
    if (body.personaPrompt === null) {
      patch.personaPrompt = null;
    } else if (typeof body.personaPrompt === 'string') {
      const personaPrompt = body.personaPrompt.trim();
      if (personaPrompt.length > 300) {
        return { patch, error: 'personaPrompt must be 300 characters or fewer' };
      }
      if (
        /ignore\s+(all|any|the|previous|prior|system)|system\s+prompt|developer\s+message|reveal.{0,20}(prompt|instruction)|tool\s+schema|<\s*\/?\s*(system|developer|tool)/i.test(
          personaPrompt
        )
      ) {
        return { patch, error: 'personaPrompt contains unsupported instructions' };
      }
      patch.personaPrompt = personaPrompt || null;
    } else {
      return { patch, error: 'personaPrompt must be a string or null' };
    }
  }
  if (body.maxSessionSeconds !== undefined) {
    if (!isPositiveInt(body.maxSessionSeconds)) {
      return { patch, error: 'maxSessionSeconds must be a positive integer' };
    }
    if (body.maxSessionSeconds < 60 || body.maxSessionSeconds > 3600) {
      return { patch, error: 'maxSessionSeconds must be between 60 and 3600' };
    }
    patch.maxSessionSeconds = body.maxSessionSeconds;
  }
  if (body.maxSessionsPerGuestPerDay !== undefined) {
    if (!isPositiveInt(body.maxSessionsPerGuestPerDay)) {
      return { patch, error: 'maxSessionsPerGuestPerDay must be a positive integer' };
    }
    if (body.maxSessionsPerGuestPerDay > 999) {
      return { patch, error: 'maxSessionsPerGuestPerDay must be between 1 and 999' };
    }
    patch.maxSessionsPerGuestPerDay = body.maxSessionsPerGuestPerDay;
  }
  if (body.maxConcurrentSessions !== undefined) {
    if (!isPositiveInt(body.maxConcurrentSessions)) {
      return { patch, error: 'maxConcurrentSessions must be a positive integer' };
    }
    if (body.maxConcurrentSessions > 50) {
      return { patch, error: 'maxConcurrentSessions must be between 1 and 50' };
    }
    patch.maxConcurrentSessions = body.maxConcurrentSessions;
  }

  return { patch, error: null };
}

export async function updateVoiceReceptionistSettings(
  propertyId: string,
  patch: VoiceReceptionistSettingsPatch
): Promise<VoiceReceptionistSettingsDto> {
  const organizationId = await getOrganizationIdForProperty(propertyId);
  await ensureVoiceReceptionistSettingsRow(propertyId, organizationId);
  const sb = db();

  const { data: current, error: readError } = await sb
    .from('ai_platform_property_settings')
    .select('*')
    .eq('property_id', propertyId)
    .eq('organization_id', organizationId)
    .single();
  if (readError) {
    console.error('[voiceReceptionistService] read property settings:', readError.message);
    throw new Error('Failed to update voice receptionist settings');
  }

  const configs = (current?.feature_configs as Record<string, unknown> | undefined) ?? {};
  const voiceConfig = (configs[VOICE_FEATURE] as Record<string, unknown> | undefined) ?? {};

  const updatedVoiceConfig: Record<string, unknown> = { ...voiceConfig };
  if (patch.enabled !== undefined) updatedVoiceConfig.enabled = patch.enabled;
  if (patch.voiceId !== undefined) updatedVoiceConfig.voice_id = patch.voiceId;
  if (patch.personaPrompt !== undefined) updatedVoiceConfig.persona_prompt = patch.personaPrompt;
  if (patch.maxSessionSeconds !== undefined)
    updatedVoiceConfig.max_session_seconds = patch.maxSessionSeconds;
  if (patch.maxSessionsPerGuestPerDay !== undefined) {
    updatedVoiceConfig.max_sessions_per_guest_per_day = patch.maxSessionsPerGuestPerDay;
  }
  if (patch.maxConcurrentSessions !== undefined) {
    updatedVoiceConfig.max_concurrent_sessions = patch.maxConcurrentSessions;
  }

  const updatedConfigs = { ...configs, [VOICE_FEATURE]: updatedVoiceConfig };
  const enabled = patch.enabled ?? (current?.enabled as boolean | undefined) ?? true;

  const { data, error } = await sb
    .from('ai_platform_property_settings')
    .update({
      enabled,
      feature_configs: updatedConfigs,
      updated_at: new Date().toISOString(),
    })
    .eq('property_id', propertyId)
    .eq('organization_id', organizationId)
    .select('*')
    .single();
  if (error) {
    console.error('[voiceReceptionistService] update property settings:', error.message);
    throw new Error('Failed to update voice receptionist settings');
  }
  return serializeSettingsRow(propertyId, data);
}

/** Start of "today" in Manila as an ISO instant (no DST in Asia/Manila, fixed UTC+8). */
function manilaStartOfTodayIso(): string {
  const todayYmd = new Date().toLocaleDateString('en-CA', { timeZone: MANILA_TZ });
  return new Date(`${todayYmd}T00:00:00+08:00`).toISOString();
}

export async function reserveVoiceReceptionistSession(input: {
  propertyId: string;
  guestUserId: string;
  conversationId: string | null;
  settings: VoiceReceptionistSettingsDto;
  providerModel: string;
  protocolVersion: string;
}): Promise<{ id: string; startedAt: string }> {
  const sb = db();
  const { data, error } = await sb.rpc('reserve_voice_receptionist_session', {
    p_property_id: input.propertyId,
    p_guest_user_id: input.guestUserId,
    p_conversation_id: input.conversationId,
    p_max_daily: input.settings.maxSessionsPerGuestPerDay,
    p_max_concurrent: input.settings.maxConcurrentSessions,
    p_provider_model: input.providerModel,
    p_protocol_version: input.protocolVersion,
  });
  if (error) {
    if (error.message.includes('voice_guest_daily_cap')) {
      throw new VoiceReceptionistCapError(
        `You've reached today's limit of ${input.settings.maxSessionsPerGuestPerDay} voice sessions for this property. Please try again tomorrow.`,
        'guest_daily_cap'
      );
    }
    if (error.message.includes('voice_concurrent_cap')) {
      throw new VoiceReceptionistCapError(
        'Our voice receptionist is at capacity for this property right now. Please try again shortly.',
        'concurrent_cap'
      );
    }
    console.error('[voiceReceptionistService] reserve session:', error.message);
    throw new Error('Failed to start voice session');
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row?.id || !row.started_at) throw new Error('Failed to start voice session');
  return { id: row.id as string, startedAt: row.started_at as string };
}

/** Release a provisional reservation when provider setup fails before the guest connects. */
export async function failVoiceReceptionistReservation(
  sessionId: string,
  guestUserId: string,
  failureCode: string
): Promise<void> {
  const endedAt = new Date().toISOString();
  const { error } = await db()
    .from('voice_receptionist_sessions')
    .update({
      status: 'failed',
      ended_at: endedAt,
      duration_seconds: 0,
      end_reason: 'provider_error',
      failure_code: failureCode.slice(0, 120),
      last_activity_at: endedAt,
    })
    .eq('id', sessionId)
    .eq('guest_user_id', guestUserId)
    .in('status', ['reserved', 'connecting']);
  if (error) {
    console.error('[voiceReceptionistService] fail reservation:', error.message);
  }
}

export async function loadVoiceReceptionistSessionForGuest(
  sessionId: string,
  guestUserId: string
): Promise<{ id: string; propertyId: string; status: string; endedAt: string | null } | null> {
  const sb = db();
  const { data, error } = await sb
    .from('voice_receptionist_sessions')
    .select('id, property_id, status, ended_at')
    .eq('id', sessionId)
    .eq('guest_user_id', guestUserId)
    .maybeSingle();
  if (error) {
    console.error('[voiceReceptionistService] load session:', error.message);
    throw new Error('Failed to load voice session');
  }
  if (!data) return null;
  return {
    id: data.id as string,
    propertyId: data.property_id as string,
    status: data.status as string,
    endedAt: (data.ended_at as string | null) ?? null,
  };
}

export async function acknowledgeVoiceReceptionistSession(
  sessionId: string,
  guestUserId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('voice_receptionist_sessions')
    .update({ status: 'active', connected_at: now, last_activity_at: now })
    .eq('id', sessionId)
    .eq('guest_user_id', guestUserId)
    .in('status', ['reserved', 'connecting', 'active'])
    .select('id')
    .maybeSingle();
  if (error) throw new Error('Failed to activate voice session');
  if (data) {
    const { error: healthError } = await db()
      .from('ai_platform_global_settings')
      .update({
        voice_receptionist_health_status: 'healthy',
        voice_receptionist_health_checked_at: now,
        voice_receptionist_health_failure_code: null,
      })
      .eq('id', 1)
      .eq('voice_receptionist_health_status', 'unhealthy');
    if (healthError) {
      console.warn('[voiceReceptionistService] provider recovery health:', healthError.message);
    }
  }
  return Boolean(data);
}

export async function heartbeatVoiceReceptionistSession(
  sessionId: string,
  guestUserId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('voice_receptionist_sessions')
    .update({ last_activity_at: now })
    .eq('id', sessionId)
    .eq('guest_user_id', guestUserId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();
  if (error) throw new Error('Failed to update voice session');
  return Boolean(data);
}

export async function markVoiceReceptionistHandoff(
  sessionId: string,
  guestUserId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('voice_receptionist_sessions')
    .update({ handoff_at: now, last_activity_at: now })
    .eq('id', sessionId)
    .eq('guest_user_id', guestUserId)
    .eq('status', 'active')
    .is('handoff_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('Failed to record voice handoff');
  return Boolean(data);
}

/** Global kill switch AND property opt-in — the same gate `voice-receptionist-start` enforces. */
export async function isVoiceReceptionistAvailableForProperty(
  propertyId: string
): Promise<boolean> {
  try {
    const global = await getGlobalVoiceReceptionistSettings();
    if (
      !isPropertyInVoiceReceptionistRollout(propertyId, global) ||
      isVoiceReceptionistCircuitOpen(global)
    ) {
      return false;
    }
    const settings = await getVoiceReceptionistSettings(propertyId);
    return settings.enabled;
  } catch (error) {
    // Never break guest chat start/resume if voice settings are missing or unreadable.
    console.error(
      '[voiceReceptionistService] availability check failed:',
      (error as Error).message
    );
    return false;
  }
}

export type VoiceReceptionistEndReason =
  | 'guest_ended'
  | 'timeout'
  | 'cap_reached'
  | 'error'
  | 'provider_go_away'
  | 'provider_error'
  | 'page_closed'
  | 'idle_timeout'
  | 'stale_reaper';

export type VoiceReceptionistSessionForEnd = {
  id: string;
  propertyId: string;
  conversationId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string;
  usageRecordedAt: string | null;
};

export async function loadVoiceReceptionistSessionForEnd(
  sessionId: string,
  guestUserId: string
): Promise<VoiceReceptionistSessionForEnd | null> {
  const sb = db();
  const { data, error } = await sb
    .from('voice_receptionist_sessions')
    .select('id, property_id, conversation_id, started_at, ended_at, status, usage_recorded_at')
    .eq('id', sessionId)
    .eq('guest_user_id', guestUserId)
    .maybeSingle();
  if (error) {
    console.error('[voiceReceptionistService] load session for end:', error.message);
    throw new Error('Failed to load voice session');
  }
  if (!data) return null;
  return {
    id: data.id as string,
    propertyId: data.property_id as string,
    conversationId: (data.conversation_id as string | null) ?? null,
    startedAt: data.started_at as string,
    endedAt: (data.ended_at as string | null) ?? null,
    status: data.status as string,
    usageRecordedAt: (data.usage_recorded_at as string | null) ?? null,
  };
}

/**
 * Sets ended_at/duration/end_reason once — safe to call again for an already-ended session.
 *
 * Cost reconciliation: `estimatedCostUsd` is a per-minute estimate, not real Gemini Live
 * billing (which re-bills prior turns each round-trip, so real cost runs higher for longer
 * calls). Quarterly, compare SUM(estimated_cost_usd) for voice_receptionist against the
 * actual Gemini Live invoice line-item for the same period and adjust
 * ai_platform_global_settings.voice_receptionist_cost_per_minute_usd if drifting.
 * Intentionally manual, not automated — reconciliation cadence/owner is an open decision
 * (see docs/workflow/planned/ai-usage-metering-credits-foundation.md).
 * Fast-follow (not required now): if the Gemini Live SDK ever exposes real input/output
 * audio token counts for a completed session, switch to cost_basis 'tokens' via
 * estimateTokenCostUsd() like every other feature.
 */
export async function endVoiceReceptionistSession(
  session: VoiceReceptionistSessionForEnd,
  endReason: VoiceReceptionistEndReason,
  guestUserId: string
): Promise<{ endedAt: string; durationSeconds: number; transitioned: boolean }> {
  const sb = db();
  const failureCode =
    endReason === 'error'
      ? 'client_reported_error'
      : endReason === 'provider_error' || endReason === 'provider_go_away'
        ? endReason
        : null;
  const { data, error } = await sb.rpc('end_voice_receptionist_session', {
    p_session_id: session.id,
    p_guest_user_id: guestUserId,
    p_end_reason: endReason,
    p_failure_code: failureCode,
  });
  if (error) {
    console.error('[voiceReceptionistService] end session:', error.message);
    throw new Error('Failed to end voice session');
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row?.ended_at) throw new Error('Failed to end voice session');
  const endedAt = row.ended_at as string;
  const durationSeconds = Number(row.duration_seconds ?? 0);
  const transitioned = row.transitioned === true;
  const costPerMinuteUsd = await getVoiceReceptionistCostPerMinuteUsd();
  const estimatedCostUsd = Math.round((durationSeconds / 60) * costPerMinuteUsd * 10000) / 10000;

  await sb
    .from('voice_receptionist_sessions')
    .update({ estimated_cost_usd: estimatedCostUsd })
    .eq('id', session.id);

  const usageClaimedAt = new Date().toISOString();
  const { data: usageClaim } = await sb
    .from('voice_receptionist_sessions')
    .update({ usage_recorded_at: usageClaimedAt })
    .eq('id', session.id)
    .is('usage_recorded_at', null)
    .select('id')
    .maybeSingle();
  try {
    if (usageClaim) {
      const orgId = await getOrganizationIdForProperty(session.propertyId);
      const voiceConfig = getModelConfig(VOICE_FEATURE);
      await recordAiUsage({
        organizationId: orgId,
        propertyId: session.propertyId,
        feature: VOICE_FEATURE,
        provider: 'gemini',
        model: voiceConfig.model,
        estimatedCostUsd,
        durationSeconds,
        actorUserId: guestUserId ?? null,
        actorType: 'guest',
      });
    }
  } catch (err) {
    console.warn('[voiceReceptionistService] usage record failed:', (err as Error).message);
    await sb
      .from('voice_receptionist_sessions')
      .update({ usage_recorded_at: null })
      .eq('id', session.id)
      .eq('usage_recorded_at', usageClaimedAt);
  }

  return { endedAt, durationSeconds, transitioned };
}

export async function reapStaleVoiceReceptionistSessions(): Promise<{
  reaped: number;
  transcriptsDeleted: number;
  propertyStats: Array<{ propertyId: string; reaped: number; transcriptsDeleted: number }>;
}> {
  const sb = db();
  const connectingBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const activeBefore = new Date(Date.now() - 90_000).toISOString();
  const { data, error } = await sb
    .from('voice_receptionist_sessions')
    .select(
      'id, property_id, guest_user_id, conversation_id, started_at, ended_at, status, usage_recorded_at'
    )
    .or(
      `and(status.in.(reserved,connecting),last_activity_at.lt.${connectingBefore}),and(status.eq.active,last_activity_at.lt.${activeBefore})`
    )
    .order('last_activity_at', { ascending: true })
    .limit(200);
  if (error) throw new Error('Failed to load stale voice sessions');

  const propertyStats = new Map<string, { reaped: number; transcriptsDeleted: number }>();
  let reaped = 0;
  for (const row of data ?? []) {
    try {
      await endVoiceReceptionistSession(
        {
          id: row.id as string,
          propertyId: row.property_id as string,
          conversationId: (row.conversation_id as string | null) ?? null,
          startedAt: row.started_at as string,
          endedAt: (row.ended_at as string | null) ?? null,
          status: row.status as string,
          usageRecordedAt: (row.usage_recorded_at as string | null) ?? null,
        },
        'stale_reaper',
        row.guest_user_id as string
      );
      const propertyId = row.property_id as string;
      const stats = propertyStats.get(propertyId) ?? { reaped: 0, transcriptsDeleted: 0 };
      stats.reaped += 1;
      propertyStats.set(propertyId, stats);
      reaped += 1;
    } catch (err) {
      console.warn('[voiceReceptionistService] stale-session reaper:', (err as Error).message);
    }
  }
  const { data: global } = await sb
    .from('ai_platform_global_settings')
    .select('voice_receptionist_transcript_retention_days')
    .eq('id', 1)
    .maybeSingle();
  const retentionDays = Math.min(
    90,
    Math.max(1, Number(global?.voice_receptionist_transcript_retention_days ?? 30))
  );
  const retentionBefore = new Date(Date.now() - retentionDays * 24 * 60 * 60_000).toISOString();
  const { data: expiredTranscripts, error: retentionError } = await sb
    .from('voice_receptionist_transcript_turns')
    .delete()
    .lt('created_at', retentionBefore)
    .select('id, session_id');
  if (retentionError) {
    console.warn('[voiceReceptionistService] transcript retention:', retentionError.message);
  } else {
    const expiredSessionIds = [
      ...new Set((expiredTranscripts ?? []).map((row) => row.session_id as string)),
    ];
    if (expiredSessionIds.length > 0) {
      const { data: expiredSessions } = await sb
        .from('voice_receptionist_sessions')
        .select('id, property_id')
        .in('id', expiredSessionIds);
      const propertyBySession = new Map(
        (expiredSessions ?? []).map((row) => [row.id as string, row.property_id as string])
      );
      for (const row of expiredTranscripts ?? []) {
        const propertyId = propertyBySession.get(row.session_id as string);
        if (!propertyId) continue;
        const stats = propertyStats.get(propertyId) ?? { reaped: 0, transcriptsDeleted: 0 };
        stats.transcriptsDeleted += 1;
        propertyStats.set(propertyId, stats);
      }
      const { error: sessionRetentionError } = await sb
        .from('voice_receptionist_sessions')
        .update({
          transcript_status: 'discarded',
          client_report_hash: null,
          safety_flags: [],
          transcript_processed_at: new Date().toISOString(),
        })
        .in('id', expiredSessionIds);
      if (sessionRetentionError) {
        console.warn(
          '[voiceReceptionistService] transcript session retention:',
          sessionRetentionError.message
        );
      }
    }
  }

  return {
    reaped,
    transcriptsDeleted: expiredTranscripts?.length ?? 0,
    propertyStats: Array.from(propertyStats, ([propertyId, stats]) => ({
      propertyId,
      ...stats,
    })),
  };
}

export async function deleteGuestVoiceTranscript(
  sessionId: string,
  guestUserId: string
): Promise<boolean> {
  const { data, error } = await db().rpc('delete_voice_receptionist_transcript', {
    p_session_id: sessionId,
    p_guest_user_id: guestUserId,
  });
  if (error) throw new Error('Failed to delete voice transcript');
  return data === true;
}

async function getVoiceReceptionistCostPerMinuteUsd(): Promise<number> {
  try {
    const global = await getAiPlatformGlobalSettings();
    return global.voiceReceptionistCostPerMinuteUsd;
  } catch (err) {
    console.warn(
      '[voiceReceptionistService] failed to load configurable rate, using fallback:',
      (err as Error).message
    );
    return FALLBACK_ESTIMATED_COST_PER_MINUTE_USD;
  }
}

export type VoiceReceptionistUsageSummary = {
  sessionsToday: number;
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  estimatedCostUsdLast30Days: number;
  failedSessionsLast30Days: number;
  handoffsLast30Days: number;
  failureRate: number;
  handoffRate: number;
  endReasonCounts: Record<string, number>;
  recentSessions: Array<{
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    endReason: string | null;
    estimatedCostUsd: number | null;
  }>;
};

/**
 * Lightweight admin usage/cost read for a property's voice receptionist — enough to spot
 * volume and rough spend at a glance, not a full analytics product (last 30 days window).
 */
export async function getVoiceReceptionistUsageSummary(
  propertyId: string
): Promise<VoiceReceptionistUsageSummary> {
  const sb = db();
  const since30dIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('voice_receptionist_sessions')
    .select(
      'started_at, ended_at, duration_seconds, end_reason, estimated_cost_usd, status, handoff_at'
    )
    .eq('property_id', propertyId)
    .gte('started_at', since30dIso)
    .order('started_at', { ascending: false });
  if (error) {
    console.error('[voiceReceptionistService] load usage summary:', error.message);
    throw new Error('Failed to load voice receptionist usage');
  }

  const rows = data ?? [];
  const todayStartIso = manilaStartOfTodayIso();
  const since7dIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let sessionsToday = 0;
  let sessionsLast7Days = 0;
  let totalDurationSeconds = 0;
  let durationCount = 0;
  let estimatedCostUsdLast30Days = 0;
  let failedSessionsLast30Days = 0;
  let handoffsLast30Days = 0;
  const endReasonCounts: Record<string, number> = {};

  for (const row of rows) {
    const startedAt = row.started_at as string;
    if (startedAt >= todayStartIso) sessionsToday += 1;
    if (startedAt >= since7dIso) sessionsLast7Days += 1;

    const duration = row.duration_seconds as number | null;
    if (typeof duration === 'number') {
      totalDurationSeconds += duration;
      durationCount += 1;
    }

    const cost = row.estimated_cost_usd as number | null;
    if (typeof cost === 'number') estimatedCostUsdLast30Days += cost;

    const reason = (row.end_reason as string | null) ?? 'open';
    endReasonCounts[reason] = (endReasonCounts[reason] ?? 0) + 1;
    if (row.status === 'failed' || row.status === 'abandoned') failedSessionsLast30Days += 1;
    if (row.handoff_at) handoffsLast30Days += 1;
  }

  return {
    sessionsToday,
    sessionsLast7Days,
    sessionsLast30Days: rows.length,
    totalDurationSeconds,
    avgDurationSeconds: durationCount > 0 ? Math.round(totalDurationSeconds / durationCount) : 0,
    estimatedCostUsdLast30Days: Math.round(estimatedCostUsdLast30Days * 10000) / 10000,
    failedSessionsLast30Days,
    handoffsLast30Days,
    failureRate:
      rows.length > 0 ? Math.round((failedSessionsLast30Days / rows.length) * 1000) / 10 : 0,
    handoffRate: rows.length > 0 ? Math.round((handoffsLast30Days / rows.length) * 1000) / 10 : 0,
    endReasonCounts,
    recentSessions: rows.slice(0, 10).map((row) => ({
      startedAt: row.started_at as string,
      endedAt: (row.ended_at as string | null) ?? null,
      durationSeconds: (row.duration_seconds as number | null) ?? null,
      endReason: (row.end_reason as string | null) ?? null,
      estimatedCostUsd: (row.estimated_cost_usd as number | null) ?? null,
    })),
  };
}

export type VoiceReceptionistTranscriptTurn = {
  role: 'guest' | 'assistant';
  text: string;
  at?: string;
};

export function sanitizeVoiceTranscriptTurns(input: unknown): VoiceReceptionistTranscriptTurn[] {
  if (!Array.isArray(input)) return [];
  const turns: VoiceReceptionistTranscriptTurn[] = [];
  let totalCharacters = 0;
  for (const raw of input) {
    if (turns.length >= 100 || totalCharacters >= 40_000) break;
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const role = row.role === 'assistant' ? 'assistant' : row.role === 'guest' ? 'guest' : null;
    const text = typeof row.text === 'string' ? row.text.trim().slice(0, 2_000) : '';
    if (!role || !text) continue;
    if (totalCharacters + text.length > 40_000) break;
    const at =
      typeof row.at === 'string' && !Number.isNaN(new Date(row.at).getTime()) ? row.at : undefined;
    turns.push({ role, text, at });
    totalCharacters += text.length;
  }
  return turns;
}

export function classifyVoiceTranscriptSafety(turns: VoiceReceptionistTranscriptTurn[]): string[] {
  const assistantText = turns
    .filter((turn) => turn.role === 'assistant')
    .map((turn) => turn.text)
    .join(' ')
    .slice(0, 40_000);
  const flags = new Set<string>();
  if (
    /\b(service role|api[_ -]?key|access token|refresh token|password|door code|lock code|account number)\b/i.test(
      assistantText
    )
  ) {
    flags.add('possible_credential_or_account_data');
  }
  if (
    /\b(owner revenue|owner profit|finance ledger|internal note|staff email|guest list|other guest)\b/i.test(
      assistantText
    )
  ) {
    flags.add('possible_internal_or_cross_guest_data');
  }
  if (/\b(system prompt|developer message|hidden instruction|tool schema)\b/i.test(assistantText)) {
    flags.add('possible_policy_disclosure');
  }
  if (
    /\b(kill yourself|self[- ]harm|make a bomb|buy illegal drugs|sexual content involving a minor)\b/i.test(
      assistantText
    )
  ) {
    flags.add('possible_high_risk_content');
  }
  return [...flags];
}

async function hashVoiceTranscript(turns: VoiceReceptionistTranscriptTurn[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(turns));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Store browser captions as bounded, explicitly unverified evidence outside social_messages. */
export async function storeClientReportedVoiceTranscript(
  session: VoiceReceptionistSessionForEnd,
  guestUserId: string,
  turns: VoiceReceptionistTranscriptTurn[]
): Promise<void> {
  if (!turns.length) return;

  const sb = db();
  const clientReportHash = await hashVoiceTranscript(turns);
  const safetyFlags = classifyVoiceTranscriptSafety(turns);
  const { data: claimed, error: claimError } = await sb
    .from('voice_receptionist_sessions')
    .update({
      client_report_hash: clientReportHash,
      transcript_status: 'client_reported',
      safety_flags: safetyFlags,
    })
    .eq('id', session.id)
    .eq('guest_user_id', guestUserId)
    .neq('transcript_status', 'discarded')
    .or(`client_report_hash.is.null,client_report_hash.eq.${clientReportHash}`)
    .select('id')
    .maybeSingle();
  if (claimError) {
    throw new Error('Failed to store voice transcript');
  }
  if (!claimed) return;

  const startedAtMs = new Date(session.startedAt).getTime();
  const endedAtMs = new Date(session.endedAt ?? Date.now()).getTime();
  const rows = turns.map((turn, sequence) => {
    const occurredAtMs = turn.at ? new Date(turn.at).getTime() : Number.NaN;
    const occurredAt =
      Number.isFinite(occurredAtMs) &&
      occurredAtMs >= startedAtMs - 60_000 &&
      occurredAtMs <= endedAtMs + 60_000
        ? new Date(occurredAtMs).toISOString()
        : null;
    return {
      session_id: session.id,
      sequence,
      role: turn.role,
      text: turn.text,
      occurred_at: occurredAt,
      source: 'client_reported',
      trust: 'unverified',
    };
  });
  const { error } = await sb
    .from('voice_receptionist_transcript_turns')
    .upsert(rows, { onConflict: 'session_id,sequence', ignoreDuplicates: true });
  if (error) {
    await sb
      .from('voice_receptionist_sessions')
      .update({ transcript_status: 'failed' })
      .eq('id', session.id);
    throw new Error('Failed to store voice transcript');
  }
  await sb
    .from('voice_receptionist_sessions')
    .update({
      transcript_status: 'stored_unverified',
      transcript_processed_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .eq('client_report_hash', clientReportHash);
}
