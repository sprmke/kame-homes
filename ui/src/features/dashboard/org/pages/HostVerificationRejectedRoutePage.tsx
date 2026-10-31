import { Navigate } from 'react-router-dom';

import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { resolveOrgLandingPath } from '@/features/dashboard/org/lib/orgLanding';
import {
  isHostVerificationHardRejected,
  readOrgVerificationDetail,
} from '@/features/dashboard/org/lib/orgVerificationTiers';
import { HostVerificationRejectedPage } from '@/features/dashboard/org/pages/HostVerificationRejectedPage';

import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';

/**
 * Hub for hard-rejected hosts after login (`/verification-rejected`).
 * If they somehow have an accessible org, send them there instead.
 */
export function HostVerificationRejectedRoutePage() {
  const { data, isLoading, isError } = useOrganizations();
  const organizations = data?.organizations ?? [];

  if (isLoading) {
    return (
      <RequireAdmin>
        <RouteGuardSkeleton fullScreen />
      </RequireAdmin>
    );
  }

  if (isError) {
    return (
      <RequireAdmin>
        <HostVerificationRejectedPage />
      </RequireAdmin>
    );
  }

  const landing = resolveOrgLandingPath(organizations);
  if (landing !== '/verification-rejected') {
    return (
      <RequireAdmin>
        <Navigate to={landing} replace />
      </RequireAdmin>
    );
  }

  const rejected =
    organizations.find((org) => isHostVerificationHardRejected(org.settings)) ?? organizations[0];
  const detail = rejected ? readOrgVerificationDetail(rejected.settings) : null;

  return (
    <RequireAdmin>
      <HostVerificationRejectedPage
        organizationName={rejected?.name}
        rejectionReason={detail?.baseRejectionReason}
      />
    </RequireAdmin>
  );
}
