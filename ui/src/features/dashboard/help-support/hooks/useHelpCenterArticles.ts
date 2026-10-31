import { useQuery } from '@tanstack/react-query';

import { fetchHelpCenterArticles } from '@/features/dashboard/help-support/lib/helpCenterApi';

export const helpCenterArticlesQueryKey = ['help-center-articles'] as const;

export function useHelpCenterArticles() {
  return useQuery({
    queryKey: helpCenterArticlesQueryKey,
    queryFn: fetchHelpCenterArticles,
    staleTime: 5 * 60_000,
  });
}
