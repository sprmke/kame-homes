import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { propertyPricingDefaultsFromDto } from '@/features/dashboard/pricing/lib/pricingCompute';
import { captureAppEvent } from '@/lib/posthog/capture';
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
    onSuccess: (data: PropertyPricingDto, patch) => {
      // Blocking a range is not a rate change; only count saves that actually set prices.
      const rateKeys = Object.keys(patch ?? {}).filter(
        (key) => key !== 'blockRange' && key !== 'unblockDateKeys'
      );
      if (rateKeys.length > 0) {
        const scope = patch?.dateOverrides
          ? 'date_override'
          : patch?.holidayRules
            ? 'season'
            : 'base';
        const count = patch?.dateOverrides
          ? Object.keys(patch.dateOverrides).length
          : patch?.holidayRules
            ? patch.holidayRules.length
            : 1;
        captureAppEvent('pricing_rates_saved', { scope, count });
      }
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
