import { useInfiniteQuery } from '@tanstack/react-query';

import { useOrgSlugParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import type { OrgReviewsPage } from '@/features/reviews/lib/orgReviewsApi';

export const ORG_REVIEWS_QUERY_KEY = 'org-reviews';

export function orgReviewsQueryKey(orgSlug: string | null, propertyId: string | null) {
  return [ORG_REVIEWS_QUERY_KEY, orgSlug, propertyId] as const;
}

export function useOrgReviews(propertyId: string | null) {
  const orgSlug = useOrgSlugParam();
  const orgId = useResolvedOrgId();
  return useInfiniteQuery({
    queryKey: orgReviewsQueryKey(orgSlug, propertyId),
    enabled: Boolean(orgSlug || orgId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (orgId) params.set('org_id', orgId);
      else if (orgSlug) params.set('org_slug', orgSlug);
      if (propertyId) params.set('property_id', propertyId);
      if (pageParam) params.set('cursor', pageParam);
      return callEdgeFunction<OrgReviewsPage>(`list-org-reviews?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });
}
