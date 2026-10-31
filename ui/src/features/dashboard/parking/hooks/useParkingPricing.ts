import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useParkingIdParam } from '@/features/dashboard/org/lib/adminParkingScope';
import {
  fetchParkingPricing,
  PARKING_PRICING_QUERY_KEY,
  saveParkingPricing,
  type ParkingPricingDto,
  type ParkingPricingPatch,
} from '@/features/dashboard/parking/lib/parkingPricingApi';

export function useParkingPricing(month?: Date) {
  const parkingId = useParkingIdParam();
  const monthKey = month ? format(month, 'yyyy-MM') : undefined;

  return useQuery({
    queryKey: [PARKING_PRICING_QUERY_KEY, parkingId, monthKey],
    queryFn: () => fetchParkingPricing(parkingId, monthKey),
    enabled: !!parkingId,
    staleTime: 30_000,
  });
}

export function useSaveParkingPricing() {
  const parkingId = useParkingIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: ParkingPricingPatch) => saveParkingPricing(parkingId, patch),
    onSuccess: (data: ParkingPricingDto) => {
      queryClient.setQueriesData({ queryKey: [PARKING_PRICING_QUERY_KEY, parkingId] }, data);
      void queryClient.invalidateQueries({
        queryKey: [PARKING_PRICING_QUERY_KEY, parkingId],
      });
      toast.success('Pricing saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save pricing');
    },
  });
}
