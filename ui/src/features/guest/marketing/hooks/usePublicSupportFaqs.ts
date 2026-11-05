import { useQuery } from '@tanstack/react-query';

import { fetchPublicSupportFaqs } from '@/features/guest/marketing/lib/publicSupportApi';

export const publicSupportFaqsQueryKey = ['public-support-faqs'] as const;

export function usePublicSupportFaqs() {
  return useQuery({
    queryKey: publicSupportFaqsQueryKey,
    queryFn: fetchPublicSupportFaqs,
    staleTime: 10 * 60_000,
  });
}
