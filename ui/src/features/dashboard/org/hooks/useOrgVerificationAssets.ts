import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { OrgApprovalDetail } from '@/features/dashboard/super-admin/types/approval';

export function orgVerificationAssetsQueryKey(orgId: string) {
  return ['org', 'verification-assets', orgId] as const;
}

export function useOrgVerificationAssets(orgId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: orgVerificationAssetsQueryKey(orgId ?? ''),
    enabled: Boolean(orgId) && enabled,
    staleTime: 5 * 60_000,
    queryFn: () =>
      callEdgeFunction<OrgApprovalDetail>(
        `get-org-verification-assets?orgId=${encodeURIComponent(orgId!)}`
      ),
  });
}
