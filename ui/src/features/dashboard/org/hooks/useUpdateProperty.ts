import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { PropertyProfileUpdatePayload } from '@/features/dashboard/org/lib/propertySettingsForm';
import type { Property } from '@/features/dashboard/org/types';

export function useUpdateProperty(orgSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PropertyProfileUpdatePayload) =>
      callEdgeFunction<{ property: Property }>('update-property', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['properties', orgSlug],
        (old: { properties: Property[] } | undefined) => {
          if (!old) return old;
          return {
            properties: old.properties.map((property) =>
              property.id === data.property.id ? data.property : property
            ),
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}
