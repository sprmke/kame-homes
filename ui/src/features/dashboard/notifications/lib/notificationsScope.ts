import { useParams } from 'react-router-dom';

import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';

/**
 * Org scope for the Notification Center — works on property routes, parking
 * routes, and org-level-only routes (properties list, org settings, etc.),
 * unlike `useOrgScopeKey` (adminApiScope.ts), which only resolves on property
 * routes.
 */
export function useNotificationsOrgScope(): { orgSlug: string | null; orgId: string | null } {
  const { orgSlug: routeOrgSlug } = useParams<{ orgSlug?: string }>();
  const tenant = useOptionalOrgContext();
  const parkingTenant = useOptionalParkingContext();
  const orgSlug = tenant?.orgSlug ?? parkingTenant?.orgSlug ?? routeOrgSlug ?? null;

  const { data: orgsData } = useOrganizations();
  const orgId =
    tenant?.org.id ??
    parkingTenant?.org.id ??
    orgsData?.organizations.find((o) => o.slug === orgSlug)?.id ??
    null;

  return { orgSlug, orgId };
}
