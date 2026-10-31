import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orgId: string) =>
      callEdgeFunction<{ deletedOrganizationId: string }>('delete-organization', {
        method: 'DELETE',
        body: JSON.stringify({ orgId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
