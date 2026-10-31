import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { propertyPricingDefaultsFromDto } from '@/features/dashboard/pricing/lib/pricingCompute';
import {
  fetchPropertyPricing,
  PROPERTY_PRICING_QUERY_KEY,
  savePropertyPricing,
  type PropertyPricingDto,
  type PropertyPricingPatch,
} from '@/features/dashboard/pricing/lib/propertyPricingApi';

export function usePropertyPricing(month?: Date) {
  const propertyId = usePropertyIdParam();
  const monthKey = month ? format(month, 'yyyy-MM') : undefined;

  return useQuery({
    queryKey: [PROPERTY_PRICING_QUERY_KEY, propertyId, monthKey],
    queryFn: () => fetchPropertyPricing(propertyId!, monthKey),
    enabled: !!propertyId,
    staleTime: 30_000,
  });
}

export function usePropertyPricingDefaults(month?: Date) {
  const query = usePropertyPricing(month);
  return {
    ...query,
    defaults: propertyPricingDefaultsFromDto(query.data),
  };
}

export function useSavePropertyPricing() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: PropertyPricingPatch) => savePropertyPricing(propertyId!, patch),
    onSuccess: (data: PropertyPricingDto) => {
      queryClient.setQueriesData({ queryKey: [PROPERTY_PRICING_QUERY_KEY, propertyId] }, data);
      void queryClient.invalidateQueries({
        queryKey: [PROPERTY_PRICING_QUERY_KEY, propertyId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['app-settings', propertyId],
      });
      toast.success('Pricing saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save pricing');
    },
  });
}
