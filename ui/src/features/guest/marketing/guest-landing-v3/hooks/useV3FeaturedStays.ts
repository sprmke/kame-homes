import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import {
  DEFAULT_PROPERTIES_QUERY,
  toPropertyCard,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';

/** Same query shape as `/` and `/v2`, so all three share one warm cache entry. */
const FEATURED_QUERY = {
  ...DEFAULT_PROPERTIES_QUERY,
  sort: 'recommended' as const,
  page: 1,
  pageSize: 8,
};

export function useV3FeaturedStays() {
  const query = usePublicProperties(FEATURED_QUERY, true, { staleTime: 5 * 60_000 });
  return {
    stays: (query.data?.data ?? []).map(toPropertyCard),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
