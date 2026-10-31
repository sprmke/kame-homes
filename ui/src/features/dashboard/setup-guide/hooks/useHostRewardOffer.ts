import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type HostRewardOffer = {
  enabled: boolean;
  eligible: boolean;
  reason: string | null;
  planCode: string | null;
  durationDays: number;
  trigger: string;
  grantsUsed: number;
  maxPerOrg: number;
};

export function useHostRewardOffer(orgId: string | undefined) {
  return useQuery({
    queryKey: ['host-reward-offer', orgId],
    enabled: Boolean(orgId),
    queryFn: () =>
      callEdgeFunction<{ offer: HostRewardOffer }>('get-host-reward-offer', {
        method: 'POST',
        body: JSON.stringify({ orgId }),
      }).then((d) => d.offer),
  });
}
