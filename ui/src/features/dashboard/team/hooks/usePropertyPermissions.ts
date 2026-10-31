import { useQuery } from '@tanstack/react-query';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { PropertyAccessPayload } from '@/features/dashboard/team/lib/propertyPermissions';

export const PROPERTY_ACCESS_QUERY_KEY = (propertyId: string) =>
  ['property-access', propertyId] as const;

export function usePropertyPermissions() {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: PROPERTY_ACCESS_QUERY_KEY(propertyId ?? ''),
    queryFn: () =>
      callEdgeFunction<PropertyAccessPayload>(
        `property-access?property_id=${encodeURIComponent(propertyId!)}`
      ),
    enabled: Boolean(propertyId),
    staleTime: 60_000,
  });
}
