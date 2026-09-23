import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { parseEdgeJsonOrQuota } from '@/features/dashboard/org/lib/aiQuotaToast';

import { adminEdgeFetch, adminEdgeFetchJson } from '@/lib/api/adminEdgeFetch';

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

export type VoiceReceptionistFormValues = {
  enabled: boolean;
  voiceId: string;
  personaPrompt: string;
  maxSessionSeconds: number;
  maxSessionsPerGuestPerDay: number;
  maxConcurrentSessions: number;
};

export function voiceReceptionistToFormValues(
  data: VoiceReceptionistSettingsDto
): VoiceReceptionistFormValues {
  return {
    enabled: data.enabled,
    voiceId: data.voiceId,
    personaPrompt: data.personaPrompt ?? '',
    maxSessionSeconds: data.maxSessionSeconds,
    maxSessionsPerGuestPerDay: data.maxSessionsPerGuestPerDay,
    maxConcurrentSessions: data.maxConcurrentSessions,
  };
}

export function voiceReceptionistFormIsDirty(
  draft: VoiceReceptionistFormValues,
  baseline: VoiceReceptionistFormValues
): boolean {
  return (
    draft.enabled !== baseline.enabled ||
    draft.voiceId !== baseline.voiceId ||
    draft.personaPrompt.trim() !== baseline.personaPrompt.trim() ||
    draft.maxSessionSeconds !== baseline.maxSessionSeconds ||
    draft.maxSessionsPerGuestPerDay !== baseline.maxSessionsPerGuestPerDay ||
    draft.maxConcurrentSessions !== baseline.maxConcurrentSessions
  );
}

export type VoiceReceptionistSettingsPatch = Partial<{
  enabled: boolean;
  voiceId: string;
  personaPrompt: string | null;
  maxSessionSeconds: number;
  maxSessionsPerGuestPerDay: number;
  maxConcurrentSessions: number;
}>;

export function buildVoiceReceptionistPatch(
  draft: VoiceReceptionistFormValues
): VoiceReceptionistSettingsPatch {
  return {
    enabled: draft.enabled,
    voiceId: draft.voiceId,
    personaPrompt: draft.personaPrompt.trim() || null,
    maxSessionSeconds: draft.maxSessionSeconds,
    maxSessionsPerGuestPerDay: draft.maxSessionsPerGuestPerDay,
    maxConcurrentSessions: draft.maxConcurrentSessions,
  };
}

const VOICE_RECEPTIONIST_SETTINGS_PATH = '/voice-receptionist-settings';

export function useVoiceReceptionistSettings() {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: ['voice-receptionist-settings', propertyId],
    queryFn: () =>
      adminEdgeFetchJson<{ data: VoiceReceptionistSettingsDto }>(
        VOICE_RECEPTIONIST_SETTINGS_PATH,
        undefined,
        propertyId,
        'Failed to load voice receptionist settings'
      ).then((json) => json.data),
    enabled: Boolean(propertyId),
  });
}

export type VoiceReceptionistUsageSummaryDto = {
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

const VOICE_RECEPTIONIST_USAGE_PATH = '/voice-receptionist-usage';

export function useVoiceReceptionistUsage() {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: ['voice-receptionist-usage', propertyId],
    queryFn: () =>
      adminEdgeFetchJson<{ data: VoiceReceptionistUsageSummaryDto }>(
        VOICE_RECEPTIONIST_USAGE_PATH,
        undefined,
        propertyId,
        'Failed to load voice receptionist usage'
      ).then((json) => json.data),
    enabled: Boolean(propertyId),
  });
}

export function useUpdateVoiceReceptionistSettings() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();
  return useMutation({
    mutationFn: async (patch: VoiceReceptionistSettingsPatch) => {
      const res = await adminEdgeFetch(
        VOICE_RECEPTIONIST_SETTINGS_PATH,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
        propertyId
      );
      const json = await parseEdgeJsonOrQuota<VoiceReceptionistSettingsDto>(res);
      return json;
    },
    onSuccess: (data) => {
      qc.setQueryData(['voice-receptionist-settings', propertyId], data);
    },
  });
}

export type VoiceReceptionistVoicePreviewDto = {
  voiceId: string;
  text: string;
  mimeType: string;
  sampleRateHz: number;
  audioBase64: string;
};

export type VoiceReceptionistVoicePreviewInput = {
  voiceId: string;
  propertyName?: string;
};

const VOICE_RECEPTIONIST_VOICE_PREVIEW_PATH = '/voice-receptionist-voice-preview';

export function usePreviewVoiceReceptionistVoice() {
  const propertyId = usePropertyIdParam();
  return useMutation({
    mutationFn: (input: VoiceReceptionistVoicePreviewInput) =>
      adminEdgeFetchJson<{ data: VoiceReceptionistVoicePreviewDto }>(
        VOICE_RECEPTIONIST_VOICE_PREVIEW_PATH,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: input.voiceId,
            propertyName: input.propertyName?.trim() || undefined,
          }),
        },
        propertyId,
        'Could not preview voice'
      ).then((json) => json.data),
  });
}
