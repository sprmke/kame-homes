import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchAiDashboardAssistantGlobalSettings,
  fetchAiDashboardAssistantSettings,
  updateAiDashboardAssistantGlobalSettings,
  updateAiDashboardAssistantSettings,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';

const settingsKey = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'ai-dashboard-assistant-settings'] as const;
const globalSettingsKey = ['super-admin', 'ai-dashboard-assistant-global-settings'] as const;

export function useAiDashboardAssistantSettings(options?: { includeUsage?: boolean }) {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useQuery({
    queryKey: [...settingsKey(orgSlug, orgId), { includeUsage: Boolean(options?.includeUsage) }],
    enabled: Boolean(orgSlug || orgId),
    queryFn: () => fetchAiDashboardAssistantSettings(orgSlug, orgId, options),
  });
}

export function useUpdateAiDashboardAssistantSettings() {
  const { orgSlug, orgId } = useOrgScopeKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      enabled?: boolean;
      disabledPropertyIds?: string[];
      dailyMessageLimit?: number;
      monthlyMessageLimit?: number;
      dailyWriteActionLimit?: number;
    }) => updateAiDashboardAssistantSettings(orgSlug, orgId, patch),
    onSuccess: () => {
      // PATCH response doesn't include `usage` — invalidate (prefix-matches both the
      // plain and includeUsage:true query key variants) instead of setQueryData so the
      // mounted settings page refetches with whichever variant it's using.
      qc.invalidateQueries({ queryKey: settingsKey(orgSlug, orgId) });
    },
  });
}

export function useAiDashboardAssistantGlobalSettings() {
  return useQuery({
    queryKey: globalSettingsKey,
    queryFn: fetchAiDashboardAssistantGlobalSettings,
  });
}

export function useUpdateAiDashboardAssistantGlobalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { enabled?: boolean; aiModeEnabled?: boolean }) =>
      updateAiDashboardAssistantGlobalSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(globalSettingsKey, data);
    },
  });
}
