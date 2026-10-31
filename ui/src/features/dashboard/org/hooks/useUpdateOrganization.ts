import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Organization } from '@/features/dashboard/org/types';

export type UpdateOrganizationInput = {
  orgId: string;
  name?: string;
  description?: string;
  tagline?: string;
  brandColor?: string;
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      callEdgeFunction<{ organization: Organization }>('update-organization', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ORGANIZATIONS_QUERY_KEY,
        (old: { organizations: Organization[] } | undefined) => {
          if (!old) return old;
          return {
            organizations: old.organizations.map((organization) =>
              organization.id === data.organization.id ? data.organization : organization
            ),
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
