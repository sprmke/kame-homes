import { useQuery } from '@tanstack/react-query';

import { useOrgSlugParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import type { OrgReviewsPage } from '@/features/reviews/lib/orgReviewsApi';
import {
  reviewsQueryToApiParams,
  type ReviewListTab,
  type ReviewsQuery,
} from '@/features/reviews/lib/propertyReviewsApi';

export const ORG_REVIEWS_QUERY_KEY = 'org-reviews';

export function orgReviewsQueryKey(orgSlug: string | null, tab: ReviewListTab, params: string) {
  return [ORG_REVIEWS_QUERY_KEY, orgSlug, tab, params] as const;
}

export function useOrgReviews(
  tab: ReviewListTab,
  query: ReviewsQuery,
  options: { enabled?: boolean; listingsOnly?: boolean } = {}
) {
  const orgSlug = useOrgSlugParam();
  const orgId = useResolvedOrgId();
  const search = reviewsQueryToApiParams(tab, query);
  // The By-property tab only needs the rollup, so it skips the feed server-side.
  if (options.listingsOnly) search.set('tab', 'properties');
  if (orgId) search.set('org_id', orgId);
  else if (orgSlug) search.set('org_slug', orgSlug);
  const params = search.toString();

  return useQuery({
    queryKey: orgReviewsQueryKey(orgSlug, tab, params),
    enabled: Boolean(orgSlug || orgId) && options.enabled !== false,
    queryFn: () => callEdgeFunction<OrgReviewsPage>(`list-org-reviews?${params}`),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}
