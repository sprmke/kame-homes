import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export function useDeleteProperty(orgSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (propertyId: string) =>
      callEdgeFunction<{ deletedPropertyId: string }>('delete-property', {
        method: 'DELETE',
        body: JSON.stringify({ propertyId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['properties', orgSlug] });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}
