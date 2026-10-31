import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type AiPlatformGlobalSettingsDto = {
  enabled: boolean;
  enforceQuotas: boolean;
  allowedFeatures: string[];
  defaultDailyCallLimit: number;
  defaultMonthlyCallLimit: number;
  defaultDailyCostUsdLimit: number;
  creditUnitUsd: number;
  voiceReceptionistCostPerMinuteUsd: number;
  voiceReceptionistRolloutPercentage: number;
  voiceReceptionistRolloutPropertyIds: string[];
  voiceReceptionistTranscriptRetentionDays: number;
  voiceReceptionistHealthStatus: 'unknown' | 'healthy' | 'unhealthy';
  voiceReceptionistHealthCheckedAt: string | null;
  voiceReceptionistHealthFailureCode: string | null;
  voiceReceptionistHealthTokenMintMs: number | null;
  voiceReceptionistHealthSetupMs: number | null;
  voiceReceptionistHealthModel: string | null;
  voiceReceptionistHealthProtocolVersion: string | null;
  voiceReceptionistMetrics: {
    days: number;
    sessions: number;
    startupMs: { p50: number | null; p95: number | null };
    firstAudioMs: { p50: number | null; p95: number | null };
    toolMs: { p50: number | null; p95: number | null };
    sessionSeconds: { p50: number | null; p95: number | null };
    reconnects: { p50: number | null; p95: number | null };
    completionRatePct: number | null;
    alerts: Record<string, boolean>;
  } | null;
  updatedAt: string | null;
};

export type AiPlatformGlobalSettingsPatch = {
  enabled?: boolean;
  enforceQuotas?: boolean;
  allowedFeatures?: string[];
  defaultDailyCallLimit?: number;
  defaultMonthlyCallLimit?: number;
  defaultDailyCostUsdLimit?: number;
  creditUnitUsd?: number;
  voiceReceptionistCostPerMinuteUsd?: number;
  voiceReceptionistRolloutPercentage?: number;
  voiceReceptionistRolloutPropertyIds?: string[];
  voiceReceptionistTranscriptRetentionDays?: number;
};

const QUERY_KEY = ['super-admin', 'ai-platform-global-settings'] as const;

export function useAiPlatformGlobalSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => callEdgeFunction<AiPlatformGlobalSettingsDto>('ai-platform-global-settings'),
  });
}

export function useUpdateAiPlatformGlobalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AiPlatformGlobalSettingsPatch) =>
      callEdgeFunction<AiPlatformGlobalSettingsDto>('ai-platform-global-settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
