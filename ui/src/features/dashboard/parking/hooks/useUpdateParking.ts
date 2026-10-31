import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PARKINGS_QUERY_KEY } from '@/features/dashboard/org/hooks/useParkings';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Parking } from '@/features/dashboard/org/types';

export function useUpdateParking(orgSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { parkingId: string } & Record<string, unknown>) =>
      callEdgeFunction<{ parking: Parking }>('update-parking', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PARKINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [...PARKINGS_QUERY_KEY, orgSlug] });
    },
  });
}

export function useDeleteParking(orgSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (parkingId: string) =>
      callEdgeFunction<{ deletedParkingId: string }>('delete-parking', {
        method: 'DELETE',
        body: JSON.stringify({ parkingId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PARKINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [...PARKINGS_QUERY_KEY, orgSlug] });
    },
  });
}
