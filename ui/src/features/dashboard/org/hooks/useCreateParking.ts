import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PARKINGS_QUERY_KEY } from '@/features/dashboard/org/hooks/useParkings';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Parking } from '@/features/dashboard/org/types';

type CreateParkingInput = {
  orgId: string;
  orgSlug: string;
  name: string;
  tower: string;
  level: string;
  slotLabel: string;
  parkingType: string;
  residenceName?: string;
  ratePerNight?: number;
};

export function useCreateParking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateParkingInput) =>
      callEdgeFunction<{ parking: Parking }>('create-parking', {
        method: 'POST',
        body: JSON.stringify({
          orgId: input.orgId,
          name: input.name,
          tower: input.tower,
          level: input.level,
          slotLabel: input.slotLabel,
          parkingType: input.parkingType,
          residenceName: input.residenceName,
          ratePerNight: input.ratePerNight,
        }),
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: PARKINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [...PARKINGS_QUERY_KEY, variables.orgSlug] });
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      // Preferred parking may have been backfilled on properties.settings
      void queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
