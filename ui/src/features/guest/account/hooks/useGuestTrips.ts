import { useQuery } from '@tanstack/react-query';

import {
  fetchGuestTrips,
  GUEST_TRIPS_QUERY_KEY,
} from '@/features/guest/account/lib/guestAccountApi';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

export function useGuestTrips() {
  const { status } = useGuestSession();

  return useQuery({
    queryKey: GUEST_TRIPS_QUERY_KEY,
    queryFn: fetchGuestTrips,
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });
}
