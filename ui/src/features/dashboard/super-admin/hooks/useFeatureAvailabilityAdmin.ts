import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  FeatureAvailabilityCatalogEntry,
  FeatureAvailabilityKey,
  FeatureAvailabilityReason,
} from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { invalidateFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import type { ResolvedFeatureAvailability } from '@/lib/featureAvailability/resolveFeatureAvailability';

export type FeatureAvailabilityAdminOverride = {
  feature_key: string;
  is_enabled: boolean;
  reason: string | null;
  message: string | null;
  expected_back_at: string | null;
  auto_restore: boolean;
  show_banner: boolean;
  super_admin_bypass: boolean;
  disabled_at: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type FeatureAvailabilityAdminData = {
  catalog: FeatureAvailabilityCatalogEntry[];
  overrides: FeatureAvailabilityAdminOverride[];
  resolved: Record<FeatureAvailabilityKey, ResolvedFeatureAvailability>;
  unusedKeys: string[];
};

export type UpdateFeatureAvailabilityInput = {
  featureKey: FeatureAvailabilityKey;
  isEnabled: boolean;
  reason?: FeatureAvailabilityReason;
  message?: string | null;
  expectedBackAt?: string | null;
  autoRestore?: boolean;
  showBanner?: boolean;
  superAdminBypass?: boolean;
};

const KEY = ['super-admin', 'feature-availability'] as const;

export function useFeatureAvailabilityAdmin() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      callEdgeFunction<FeatureAvailabilityAdminData>('feature-availability').then((data) => data),
  });
}

export function useUpdateFeatureAvailabilityAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFeatureAvailabilityInput) =>
      callEdgeFunction<{ override: FeatureAvailabilityAdminOverride }>('feature-availability', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      invalidateFeatureAvailability(qc);
      toast.success('Feature availability saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save feature availability'),
  });
}

export function useDeleteUnusedFeatureAvailabilityRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (featureKey: string) =>
      callEdgeFunction<{ deleted: true }>('feature-availability', {
        method: 'DELETE',
        body: JSON.stringify({ featureKey }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success('Unused row removed');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not remove row'),
  });
}
