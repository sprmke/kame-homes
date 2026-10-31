import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { HostAnnouncementDraft } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

const PLATFORM_HOST_SETTINGS_KEY = ['super-admin', 'platform-host-settings'] as const;

type PlatformHostSettingsResponse = {
  announcements: HostAnnouncementDraft[];
  updatedAt: string | null;
};

export function usePlatformHostSettings() {
  return useQuery({
    queryKey: PLATFORM_HOST_SETTINGS_KEY,
    queryFn: () => callEdgeFunction<PlatformHostSettingsResponse>('get-platform-host-settings'),
  });
}

export function useUpdatePlatformHostSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { announcements: HostAnnouncementDraft[] }) =>
      callEdgeFunction<PlatformHostSettingsResponse>('update-platform-host-settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(PLATFORM_HOST_SETTINGS_KEY, data);
      void queryClient.invalidateQueries({ queryKey: ['host-announcements'] });
    },
  });
}
