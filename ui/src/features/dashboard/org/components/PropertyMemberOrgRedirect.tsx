import { useEffect } from 'react';

import { Navigate, useNavigate } from 'react-router-dom';

import { TenantAccessDenied } from '@/features/dashboard/org/components/TenantAccessDenied';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { resolveOrgLandingPath } from '@/features/dashboard/org/lib/orgLanding';
import {
  getLastPropertySlug,
  propertySectionPath,
  setLastTenantContext,
} from '@/features/dashboard/org/lib/tenantPaths';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

type Props = {
  orgSlug: string;
};

/** Property-only members cannot use org-scoped routes — send them to an assigned property. */
export function PropertyMemberOrgRedirect({ orgSlug }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProperties(orgSlug);
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();

  useEffect(() => {
    if (isLoading || isError) return;
    const properties = data?.properties ?? [];
    if (properties.length === 0) return;

    const property =
      properties.find((entry) => entry.slug === getLastPropertySlug()) ?? properties[0]!;
    setLastTenantContext(orgSlug, property.slug);
    navigate(propertySectionPath(orgSlug, property.slug, 'dashboard'), {
      replace: true,
    });
  }, [data, isError, isLoading, navigate, orgSlug]);

  if (isLoading || orgsLoading) {
    return <RouteGuardLoading />;
  }

  if (isError || !data?.properties.length) {
    const otherOrgs = (orgsData?.organizations ?? []).filter((org) => org.slug !== orgSlug);
    if (otherOrgs.length > 0) {
      return <Navigate to={resolveOrgLandingPath(otherOrgs)} replace />;
    }
    return <TenantAccessDenied scope="org" orgSlug={orgSlug} />;
  }

  return <RouteGuardLoading />;
}
