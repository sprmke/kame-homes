import { useQuery } from '@tanstack/react-query';

import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { ParkingAccessPayload } from '@/features/dashboard/team/lib/parkingPermissions';

export const PARKING_ACCESS_QUERY_KEY = (parkingId: string) =>
  ['parking-access', parkingId] as const;

export function useParkingPermissions() {
  const parkingId = useOptionalParkingContext()?.parking.id ?? null;

  return useQuery({
    queryKey: PARKING_ACCESS_QUERY_KEY(parkingId ?? ''),
    queryFn: () =>
      callEdgeFunction<ParkingAccessPayload>(
        `parking-access?parking_id=${encodeURIComponent(parkingId!)}`
      ),
    enabled: Boolean(parkingId),
    staleTime: 60_000,
  });
}
