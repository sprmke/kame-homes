import { useQuery } from '@tanstack/react-query';

import {
  fetchGuestMessages,
  GUEST_MESSAGES_QUERY_KEY,
} from '@/features/guest/account/lib/guestAccountApi';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

export function useGuestMessages() {
  const { status } = useGuestSession();

  return useQuery({
    queryKey: GUEST_MESSAGES_QUERY_KEY,
    queryFn: fetchGuestMessages,
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}
