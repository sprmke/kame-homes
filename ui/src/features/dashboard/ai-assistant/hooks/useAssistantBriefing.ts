import { useQuery } from '@tanstack/react-query';

import { fetchAssistantBriefing } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';

/** "Needs attention" cards for the AI mode home. Same cache cadence as dashboard-stats. */
export function useAssistantBriefing(
  scope: { propertyId: string | null; parkingId: string | null },
  enabled: boolean
) {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useQuery({
    queryKey: [
      'org',
      orgSlug ?? orgId,
      'ai-assistant-briefing',
      scope.propertyId ?? scope.parkingId ?? 'org',
    ],
    enabled: enabled && Boolean(orgSlug || orgId),
    queryFn: () => fetchAssistantBriefing(orgSlug, orgId, scope),
    staleTime: 45_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
