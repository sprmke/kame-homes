import { useQuery } from '@tanstack/react-query';

import {
  DEFAULT_DEVELOPMENTS_QUERY,
  toDevelopmentCard,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import type { Development } from '@/features/guest/marketing/developments/types';

import { fetchPublicDevelopments, PUBLIC_DEVELOPMENTS_QUERY_KEY } from './usePublicDevelopments';

export function usePublicDevelopment(slug: string, enabled = true) {
  const trimmed = slug.trim().toLowerCase();

  return useQuery({
    queryKey: [...PUBLIC_DEVELOPMENTS_QUERY_KEY, 'slug', trimmed],
    queryFn: async ({ signal }): Promise<Development | null> => {
      const result = await fetchPublicDevelopments(
        {
          ...DEFAULT_DEVELOPMENTS_QUERY,
          slug: trimmed,
          page: 1,
          pageSize: 1,
        },
        signal
      );
      const item = result.data[0];
      return item ? toDevelopmentCard(item) : null;
    },
    staleTime: 30_000,
    retry: 1,
    enabled: enabled && Boolean(trimmed),
  });
}
