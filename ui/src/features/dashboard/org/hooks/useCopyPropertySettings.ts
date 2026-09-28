import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PROPERTY_TEMPLATES_QUERY_KEY } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { copyPropertySettingsLogsQueryKey } from '@/features/dashboard/org/hooks/usePropertySettingsCopyLogs';
import {
  copyPropertySettings,
  copyPropertySettingsUpgradeFeature,
  isCopyPropertySettingsUpgradeError,
  type CopyPropertySettingsRequest,
  type CopyPropertySettingsResponse,
} from '@/features/dashboard/org/lib/copyPropertySettingsApi';
import {
  hasUpgradeModalOpener,
  openUpgradeModalFromBridge,
} from '@/features/dashboard/plans/lib/upgradeModalBridge';
import { SMART_PRICING_QUERY_KEY } from '@/features/dashboard/pricing/lib/smartPricingApi';

function invalidateTargetCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  orgSlug: string,
  targetPropertyIds: string[]
) {
  void queryClient.invalidateQueries({ queryKey: ['properties', orgSlug] });
  void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: copyPropertySettingsLogsQueryKey(orgSlug) });
  void queryClient.invalidateQueries({ queryKey: ['app-settings'] });
  void queryClient.invalidateQueries({ queryKey: PROPERTY_TEMPLATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: [SMART_PRICING_QUERY_KEY] });
  void queryClient.invalidateQueries({ queryKey: ['telegram-admin-settings'] });
  void queryClient.invalidateQueries({ queryKey: ['telegram-staff-settings'] });
  void queryClient.invalidateQueries({ queryKey: ['telegram-marketing-settings'] });
  void queryClient.invalidateQueries({ queryKey: ['telegram-finance-settings'] });
  void queryClient.invalidateQueries({ queryKey: ['telegram-maintenance-settings'] });
  void queryClient.invalidateQueries({ queryKey: ['telegram-chat-settings'] });
  void queryClient.invalidateQueries({ queryKey: ['telegram-parking-settings'] });

  for (const propertyId of targetPropertyIds) {
    void queryClient.invalidateQueries({ queryKey: ['app-settings', propertyId] });
    void queryClient.invalidateQueries({
      queryKey: [...PROPERTY_TEMPLATES_QUERY_KEY, propertyId],
    });
  }
}

function successToast(data: CopyPropertySettingsResponse) {
  const withFailures = data.results.filter((r) => r.failed.length > 0);
  const allFailed = data.results.every((r) => r.applied.length === 0 && r.failed.length > 0);

  if (allFailed) {
    const first = withFailures[0]?.failed[0];
    toast.error(first?.error ?? 'Copy failed');
    return;
  }

  if (withFailures.length > 0) {
    const sample = withFailures
      .slice(0, 2)
      .map((r) => r.failed[0]?.error ?? 'Error')
      .join('; ');
    const copiedCount = data.results.filter((r) => r.applied.length > 0).length;
    toast.warning(
      `Copied to ${copiedCount} of ${data.results.length} (some groups failed). ${sample}${withFailures.length > 2 ? '…' : ''}`
    );
    return;
  }

  toast.success(
    data.results.length === 1
      ? 'Settings copied to 1 property'
      : `Settings copied to ${data.results.length} properties`
  );
}

export function useCopyPropertySettings(orgSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CopyPropertySettingsRequest) => copyPropertySettings(body),
    onSuccess: (data, variables) => {
      if (variables.dryRun) return;
      invalidateTargetCaches(queryClient, orgSlug, variables.targetPropertyIds);
      successToast(data);
    },
    onError: (error: Error, variables) => {
      if (variables.dryRun) return;
      if (isCopyPropertySettingsUpgradeError(error)) {
        const feature = copyPropertySettingsUpgradeFeature(error);
        if (hasUpgradeModalOpener()) openUpgradeModalFromBridge(feature);
        toast.error(error.message || 'Upgrade required');
        return;
      }
      toast.error(error.message || 'Copy failed');
    },
  });
}
