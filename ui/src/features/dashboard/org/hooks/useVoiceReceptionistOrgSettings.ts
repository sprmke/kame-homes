import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scopedOrgFunctionsUrl, useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';
import { parseEdgeJsonOrQuota } from '@/features/dashboard/org/lib/aiQuotaToast';

import { supabase } from '@/lib/supabase/client';

export type VoiceReceptionistOrgSettingsDto = {
  organizationId: string;
  enabled: boolean;
  voiceId: string;
  personaPrompt: string | null;
  disabledPropertyIds: string[];
  availableVoices: readonly string[];
  /** True when at least one org property's plan includes the voice receptionist. */
  planAllowed: boolean;
};

export type VoiceReceptionistFormValues = {
  enabled: boolean;
  voiceId: string;
  personaPrompt: string;
  disabledPropertyIds: string[];
};

export function voiceReceptionistToFormValues(
  data: VoiceReceptionistOrgSettingsDto
): VoiceReceptionistFormValues {
  return {
    enabled: data.enabled,
    voiceId: data.voiceId,
    personaPrompt: data.personaPrompt ?? '',
    disabledPropertyIds: [...data.disabledPropertyIds],
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
    [...draft.disabledPropertyIds].sort().join(',') !==
      [...baseline.disabledPropertyIds].sort().join(',')
  );
}

export type VoiceReceptionistOrgSettingsPatch = Partial<{
  enabled: boolean;
  voiceId: string;
  personaPrompt: string | null;
  disabledPropertyIds: string[];
}>;

export function buildVoiceReceptionistPatch(
  draft: VoiceReceptionistFormValues
): VoiceReceptionistOrgSettingsPatch {
  return {
    enabled: draft.enabled,
    voiceId: draft.voiceId,
    personaPrompt: draft.personaPrompt.trim() || null,
    disabledPropertyIds: draft.disabledPropertyIds,
  };
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

export type VoiceReceptionistVoicePreviewDto = {
  voiceId: string;
  text: string;
  mimeType: string;
  sampleRateHz: number;
  audioBase64: string;
};

async function fetchOrgVoice<T>(url: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('No active session. Please sign in');
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  return parseEdgeJsonOrQuota<T>(res);
}

const settingsKey = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'voice-receptionist-settings'] as const;
const usageKey = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'voice-receptionist-usage'] as const;

export function useVoiceReceptionistOrgSettings() {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useQuery({
    queryKey: settingsKey(orgSlug, orgId),
    enabled: Boolean(orgSlug || orgId),
    queryFn: () =>
      fetchOrgVoice<VoiceReceptionistOrgSettingsDto>(
        scopedOrgFunctionsUrl('voice-receptionist-settings', orgSlug, orgId)
      ),
  });
}

export function useUpdateVoiceReceptionistOrgSettings() {
  const { orgSlug, orgId } = useOrgScopeKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: VoiceReceptionistOrgSettingsPatch) =>
      fetchOrgVoice<VoiceReceptionistOrgSettingsDto>(
        scopedOrgFunctionsUrl('voice-receptionist-settings', orgSlug, orgId),
        { method: 'PATCH', body: JSON.stringify(patch) }
      ),
    onSuccess: (data) => {
      qc.setQueryData(settingsKey(orgSlug, orgId), data);
    },
  });
}

export function useVoiceReceptionistOrgUsage(enabled: boolean) {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useQuery({
    queryKey: usageKey(orgSlug, orgId),
    enabled: enabled && Boolean(orgSlug || orgId),
    queryFn: () =>
      fetchOrgVoice<VoiceReceptionistUsageSummaryDto>(
        scopedOrgFunctionsUrl('voice-receptionist-usage', orgSlug, orgId)
      ),
    staleTime: 30_000,
  });
}

export function usePreviewVoiceReceptionistVoice() {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useMutation({
    mutationFn: (input: { voiceId: string }) =>
      fetchOrgVoice<VoiceReceptionistVoicePreviewDto>(
        scopedOrgFunctionsUrl('voice-receptionist-voice-preview', orgSlug, orgId),
        { method: 'POST', body: JSON.stringify({ voiceId: input.voiceId }) }
      ),
  });
}
