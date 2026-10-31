import { useEffect, useMemo } from 'react';

import { useParams } from 'react-router-dom';

import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';

import { isPostHogEnabled, posthog } from '@/lib/posthog/client';
import { PostHogContextSync } from '@/lib/posthog/PostHogContextSync';

/** Resolves org / property / parking UUIDs inside admin shells for group analytics. */
export function PostHogAdminScopeSync() {
  const tenant = useOptionalOrgContext();
  const parkingTenant = useOptionalParkingContext();
  const { orgSlug: routeOrgSlug } = useParams<{ orgSlug?: string }>();
  const { data: orgsData } = useOrganizations();

  const orgId = useMemo(() => {
    if (tenant?.org.id) return tenant.org.id;
    if (parkingTenant?.org.id) return parkingTenant.org.id;
    if (!routeOrgSlug) return undefined;
    return orgsData?.organizations.find((o) => o.slug === routeOrgSlug)?.id;
  }, [tenant?.org.id, parkingTenant?.org.id, routeOrgSlug, orgsData?.organizations]);

  const orgSlug = tenant?.orgSlug ?? parkingTenant?.orgSlug ?? routeOrgSlug;

  useEffect(() => {
    if (!isPostHogEnabled) return;
    if (orgId) {
      posthog.group('organization', orgId, {
        ...(orgSlug ? { slug: orgSlug } : {}),
      });
    }
    if (tenant?.property.id) {
      posthog.group('property', tenant.property.id, {
        slug: tenant.propertySlug,
        name: tenant.property.name,
      });
    }
    if (parkingTenant?.parking.id) {
      posthog.group('parking', parkingTenant.parking.id, {
        slug: parkingTenant.parkingSlug,
        name: parkingTenant.parking.name,
      });
    }
  }, [
    orgId,
    orgSlug,
    tenant?.property.id,
    tenant?.propertySlug,
    tenant?.property.name,
    parkingTenant?.parking.id,
    parkingTenant?.parkingSlug,
    parkingTenant?.parking.name,
  ]);

  return (
    <PostHogContextSync
      orgId={orgId}
      propertyId={tenant?.property.id}
      parkingId={parkingTenant?.parking.id}
    />
  );
}
