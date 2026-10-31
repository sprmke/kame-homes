import { useQuery } from '@tanstack/react-query';

import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export const PROPERTY_GUEST_REVIEWS_QUERY_KEY = ['property-guest-reviews'] as const;

export type ListPropertyGuestReviewsParams = {
  minRating?: number;
  limit?: number;
  source?: 'kame' | 'facebook' | 'airbnb' | 'all';
  socialSeedOnly?: boolean;
};

async function fetchPropertyGuestReviews(
  propertyId: string | null,
  params: ListPropertyGuestReviewsParams
): Promise<MarketingGuestReview[]> {
  if (!propertyId) return [];
  const jwt = await getSessionJwt();
  const search = new URLSearchParams();
  if (params.minRating != null) search.set('minRating', String(params.minRating));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.source && params.source !== 'all') search.set('source', params.source);
  if (params.socialSeedOnly) search.set('socialSeedOnly', '1');
  const qs = search.toString();
  const path = scopedFunctionsUrl('list-property-guest-reviews', propertyId);
  const res = await fetch(qs ? `${path}&${qs}` : path, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { reviews?: MarketingGuestReview[] };
  };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load reviews');
  }
  return json.data?.reviews ?? [];
}

export function usePropertyGuestReviews(params: ListPropertyGuestReviewsParams = {}) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [...PROPERTY_GUEST_REVIEWS_QUERY_KEY, propertyId, params],
    queryFn: () => fetchPropertyGuestReviews(propertyId, params),
    enabled: Boolean(propertyId),
    staleTime: 30_000,
  });
}
