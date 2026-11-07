import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  PropertyLifecycle,
  PropertyLifecycleAction,
  PropertyLifecycleImpact,
  PropertyLifecycleMutationResponse,
} from '@/features/dashboard/org/lib/propertyLifecycle';
import type { Property } from '@/features/dashboard/org/types';
import { captureAppEvent } from '@/lib/posthog/capture';

const lifecycleKey = (propertyId: string) => ['property-lifecycle', propertyId] as const;
const impactKey = (propertyId: string) => ['property-lifecycle-impact', propertyId] as const;

/** Lifecycle state + allowed actions. Cheap: one row, no impact counts. */
export function usePropertyLifecycle(propertyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lifecycleKey(propertyId),
    queryFn: () =>
      callEdgeFunction<{ lifecycle: PropertyLifecycle }>(
        `property-lifecycle?property_id=${encodeURIComponent(propertyId)}`,
        { method: 'GET' }
      ).then((data) => data.lifecycle),
    enabled: Boolean(propertyId) && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

/** Impact counts for the confirmation sheet. Loaded only when a sheet opens. */
export function usePropertyLifecycleImpact(propertyId: string, enabled: boolean) {
  return useQuery({
    queryKey: impactKey(propertyId),
    queryFn: () =>
      callEdgeFunction<{ lifecycle: PropertyLifecycle; impact: PropertyLifecycleImpact }>(
        `property-lifecycle?property_id=${encodeURIComponent(propertyId)}&impact=1`,
        { method: 'GET' }
      ).then((data) => data.impact),
    enabled: Boolean(propertyId) && enabled,
    staleTime: 0,
  });
}

export function usePropertyLifecycleAction(orgSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, action }: { propertyId: string; action: PropertyLifecycleAction }) =>
      callEdgeFunction<PropertyLifecycleMutationResponse>('property-lifecycle', {
        method: 'POST',
        body: JSON.stringify({ property_id: propertyId, action }),
      }),
    onSuccess: (data, variables) => {
      captureAppEvent('property_lifecycle_changed', { action: variables.action });

      // Update the cached list row in place so the page shell reacts without a flash.
      queryClient.setQueryData(
        ['properties', orgSlug],
        (old: { properties: Property[] } | undefined) => {
          if (!old) return old;
          return {
            properties: old.properties.map((property) =>
              property.id === data.property.id
                ? {
                    ...property,
                    status: data.property.status,
                    inactiveReason: data.property.inactiveReason,
                    archivedAt: data.property.archivedAt,
                    pausedAt: data.property.pausedAt,
                    updatedAt: new Date().toISOString(),
                  }
                : property
            ),
          };
        }
      );

      queryClient.setQueryData(lifecycleKey(data.property.id), data.lifecycle);
      void queryClient.invalidateQueries({ queryKey: impactKey(data.property.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}
