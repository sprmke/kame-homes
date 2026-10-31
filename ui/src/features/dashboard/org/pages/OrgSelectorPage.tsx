import { Navigate } from 'react-router-dom';

import { useMemo } from 'react';

import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import {
  pickLandingOrgSlug,
  resolveOrgLandingPath,
} from '@/features/dashboard/org/lib/orgLanding';
import { getLastOrgSlug, getLastTenantKind } from '@/features/dashboard/org/lib/tenantPaths';

import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';

/**
 * `/org` hub — no selector UI. Sends the user to their org dashboard (last-used or first),
 * or to the last visited listing (property/parking dashboard) in that org, or onboarding
 * when they have no organizations.
 */
export function OrgSelectorPage() {
  const { data, isLoading, isError } = useOrganizations();
  const organizations = isLoading ? [] : (data?.organizations ?? []);

  const orgSlug = useMemo(() => pickLandingOrgSlug(organizations), [data, isLoading]);

  // Validate the stored last-visited listing against the target org's actual listings.
  // Queries stay pending (idle) when no slug / kind is stored, so no extra requests then.
  const needsListingValidation =
    orgSlug !== null && getLastOrgSlug() === orgSlug && getLastTenantKind() !== null;
  const propsQuery = useProperties(orgSlug ?? undefined);
  const parkingsQuery = useParkings(orgSlug ?? undefined);
  const listingListsReady =
    !needsListingValidation || (propsQuery.isPending === false && parkingsQuery.isPending === false);

  const propertySlugs = propsQuery.data?.properties.map((property) => property.slug);
  const parkingSlugs = parkingsQuery.data?.parkings.map((parking) => parking.slug);

  const landingPath = useMemo(() => {
    if (isError || organizations.length === 0) return null;
    if (!listingListsReady) return null;
    return resolveOrgLandingPath(organizations, {
      propertySlugs,
      parkingSlugs,
    });
  }, [
    isError,
    organizations,
    listingListsReady,
    propertySlugs,
    parkingSlugs,
  ]);

  return (
    <RequireAdmin>
      {isLoading || (organizations.length > 0 && landingPath === null) ? (
        <RouteGuardSkeleton fullScreen />
      ) : isError || landingPath === null ? (
        <Navigate to="/onboarding" replace />
      ) : (
        <Navigate to={landingPath} replace />
      )}
    </RequireAdmin>
  );
}
