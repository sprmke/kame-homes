import { Navigate, useParams } from 'react-router-dom';

import { TenantSlugRemapRedirect } from '@/features/dashboard/org/components/TenantSlugRemapRedirect';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import {
  isHostVerificationHardRejected,
  readOrgVerificationDetail,
} from '@/features/dashboard/org/lib/orgVerificationTiers';
import { HostVerificationRejectedPage } from '@/features/dashboard/org/pages/HostVerificationRejectedPage';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

type Props = {
  children: React.ReactNode;
};

/** Blocks org/property/parking shells when Tier 1 verification was hard-rejected. */
export function RequireOrgNotHardRejected({ children }: Props) {
  return (
    <TenantSlugRemapRedirect>
      <RequireOrgNotHardRejectedInner>{children}</RequireOrgNotHardRejectedInner>
    </TenantSlugRemapRedirect>
  );
}

function RequireOrgNotHardRejectedInner({ children }: Props) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const orgsQuery = useOrganizations();

  if (orgsQuery.isLoading) {
    return <RouteGuardLoading />;
  }

  if (!orgSlug) {
    return <Navigate to="/org" replace />;
  }

  const org = orgsQuery.data?.organizations.find((entry) => entry.slug === orgSlug);
  if (!org) {
    return <>{children}</>;
  }

  if (isHostVerificationHardRejected(org.settings)) {
    const detail = readOrgVerificationDetail(org.settings);
    return (
      <HostVerificationRejectedPage
        organizationName={org.name}
        rejectionReason={detail.baseRejectionReason}
      />
    );
  }

  return <>{children}</>;
}
