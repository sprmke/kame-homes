import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  hasUpgradeModalOpener,
  openUpgradeModalFromBridge,
} from '@/features/dashboard/plans/lib/upgradeModalBridge';
import { PROPERTY_PRICING_QUERY_KEY } from '@/features/dashboard/pricing/lib/propertyPricingApi';
import {
  applySmartPricing,
  clearSmartPricing,
  fetchSmartPricingSettings,
  previewSmartPricing,
  saveSmartPricingSettings,
  SMART_PRICING_QUERY_KEY,
  type SmartPricingClientError,
  type SmartPricingSettingsPatch,
} from '@/features/dashboard/pricing/lib/smartPricingApi';

function handleError(error: Error, fallback: string): void {
  const err = error as SmartPricingClientError;
  if (err.upgradeRequired) {
    const feature: PlanFeatureKey = err.feature ?? 'smartPricing';
    if (hasUpgradeModalOpener()) openUpgradeModalFromBridge(feature);
    toast.error(err.message || fallback);
    return;
  }
  toast.error(error.message || fallback);
}

export function useSmartPricingSettings(options?: { enabled?: boolean }) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [SMART_PRICING_QUERY_KEY, propertyId],
    queryFn: () => fetchSmartPricingSettings(propertyId!),
    enabled: !!propertyId && (options?.enabled ?? true),
    staleTime: 20_000,
  });
}

function useInvalidate() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [SMART_PRICING_QUERY_KEY, propertyId] });
    void queryClient.invalidateQueries({ queryKey: [PROPERTY_PRICING_QUERY_KEY, propertyId] });
  };
}

export function useSaveSmartPricingSettings() {
  const propertyId = usePropertyIdParam();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: SmartPricingSettingsPatch) => saveSmartPricingSettings(propertyId!, patch),
    onSuccess: () => invalidate(),
    onError: (error: Error) => handleError(error, 'Could not save Smart Pricing settings'),
  });
}

export function usePreviewSmartPricing() {
  const propertyId = usePropertyIdParam();
  return useMutation({
    mutationFn: (opts?: { explain?: boolean }) => previewSmartPricing(propertyId!, opts),
    onError: (error: Error) => handleError(error, 'Could not build a Smart Pricing preview'),
  });
}

export function useApplySmartPricing() {
  const propertyId = usePropertyIdParam();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { runId: string; ranges?: Array<{ start: string; end: string }> }) =>
      applySmartPricing(propertyId!, input),
    onSuccess: (data) => {
      invalidate();
      toast.success(
        `Smart Pricing applied to ${data.applied} night${data.applied === 1 ? '' : 's'}` +
          (data.skippedUnavailable
            ? `. ${data.skippedUnavailable} skipped (now booked/blocked)`
            : '')
      );
    },
    onError: (error: Error) => handleError(error, 'Could not apply Smart Pricing'),
  });
}

export function useClearSmartPricing() {
  const propertyId = usePropertyIdParam();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => clearSmartPricing(propertyId!),
    onSuccess: () => {
      invalidate();
      toast.success('Smart Pricing cleared. Your manual rates are active');
    },
    onError: (error: Error) => handleError(error, 'Could not clear Smart Pricing'),
  });
}
