import { useQuery } from '@tanstack/react-query';

import { listPropertySettingsCopyLogs } from '@/features/dashboard/org/lib/copyPropertySettingsApi';

export function copyPropertySettingsLogsQueryKey(orgSlug: string | undefined) {
  return ['property-settings-copy-logs', orgSlug] as const;
}

export function usePropertySettingsCopyLogs(orgSlug: string | undefined, enabled = true) {
  return useQuery({
    queryKey: copyPropertySettingsLogsQueryKey(orgSlug),
    enabled: Boolean(orgSlug) && enabled,
    queryFn: () => listPropertySettingsCopyLogs({ orgSlug: orgSlug! }),
  });
}
