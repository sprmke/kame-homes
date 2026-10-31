import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type ParkingBroadcastResponse = 'pending' | 'claimed' | 'declined' | 'expired' | null;

type ParkingBroadcastStatus = { exists: boolean; response: ParkingBroadcastResponse };

/** Is this parking a live/past broadcast candidate for a booking? Gates Accept/Decline. */
export function useParkingBroadcastStatus(
  bookingId: string | undefined,
  parkingId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['parking-broadcast-status', bookingId, parkingId],
    queryFn: () =>
      callEdgeFunction<ParkingBroadcastStatus>(
        `get-parking-broadcast-status?bookingId=${encodeURIComponent(bookingId ?? '')}&parking_id=${encodeURIComponent(parkingId ?? '')}`
      ),
    enabled: enabled && Boolean(bookingId) && Boolean(parkingId),
  });
}
