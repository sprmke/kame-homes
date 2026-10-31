import { useQuery } from '@tanstack/react-query';

import { fetchHelpCenterFaqs } from '@/features/dashboard/help-support/lib/helpCenterApi';

export const helpCenterFaqsQueryKey = ['help-center-faqs'] as const;

export function useHelpCenterFaqs() {
  return useQuery({
    queryKey: helpCenterFaqsQueryKey,
    queryFn: fetchHelpCenterFaqs,
    staleTime: 5 * 60_000,
  });
}
