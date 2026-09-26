import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type PlatformSettings = {
  defaultPlanCode: string | null;
  signupsEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  supportEmail: string | null;
  legalTermsUrl: string | null;
  legalPrivacyUrl: string | null;
  publicRateLimitPerMin: number;
  authenticatedRateLimitEnforce: boolean;
  authenticatedRateLimitPerMin: number;
  hostRewardEnabled: boolean;
  hostRewardPlanCode: string | null;
  hostRewardDurationDays: number;
  hostRewardTrigger: 'recommended_verification_submitted' | 'recommended_verification_approved';
  hostRewardCampaignStart: string | null;
  hostRewardCampaignEnd: string | null;
  hostRewardMaxPerOrg: number;
  hostRewardApplyToPaidOrg: 'skip' | 'extend';
  updatedAt: string;
};

const KEY = ['super-admin', 'platform-settings'] as const;

export function usePlatformSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      callEdgeFunction<{ settings: PlatformSettings }>('platform-settings').then((d) => d.settings),
  });
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<PlatformSettings, 'updatedAt'>>) =>
      callEdgeFunction<{ settings: PlatformSettings }>('platform-settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }).then((d) => d.settings),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success('Platform settings saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save settings'),
  });
}
