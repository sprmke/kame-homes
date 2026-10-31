import { useEffect } from 'react';

import { Navigate, useLocation } from 'react-router-dom';

import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { isPropertyOnlyOrgAccess } from '@/features/dashboard/org/lib/orgAccessKind';
import { mapLegacyAdminPath } from '@/features/dashboard/org/lib/postSignInRouting';
import {
  getLastOrgSlug,
  getLastPropertySlug,
  propertyNotificationsPath,
  propertySectionPath,
  setLastTenantContext,
} from '@/features/dashboard/org/lib/tenantPaths';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

type Props = {
  toSection?:
    | 'dashboard'
    | 'bookings'
    | 'finance'
    | 'maintenance'
    | 'notifications'
    | 'marketing'
    | 'staff'
    | 'operations'
    | 'team'
    | 'settings';
};

/** Redirects legacy flat admin URLs to the user's current org/property scope. */
export function LegacyAdminRedirect({ toSection = 'dashboard' }: Props) {
  const location = useLocation();
  const orgsQuery = useOrganizations();
  const lastOrgSlug = getLastOrgSlug();
  const org =
    orgsQuery.data?.organizations.find((o) => o.slug === lastOrgSlug) ??
    orgsQuery.data?.organizations[0];
  const propsQuery = useProperties(org?.slug);

  useEffect(() => {
    if (org && propsQuery.data?.properties[0]) {
      const property =
        propsQuery.data.properties.find((p) => p.slug === getLastPropertySlug()) ??
        propsQuery.data.properties[0];
      setLastTenantContext(org.slug, property.slug);
    }
  }, [org, propsQuery.data]);

  if (orgsQuery.isLoading || (org && propsQuery.isLoading)) {
    return <RouteGuardLoading fullScreen />;
  }

  if (!org) {
    return <Navigate to="/onboarding" replace />;
  }

  const properties = propsQuery.data?.properties ?? [];
  if (properties.length === 0) {
    if (isPropertyOnlyOrgAccess(org.accessKind)) {
      return <Navigate to="/org" replace />;
    }
    return <Navigate to={`/org/${org.slug}/properties`} replace />;
  }

  const property = properties.find((p) => p.slug === getLastPropertySlug()) ?? properties[0]!;

  const path = location.pathname;
  const legacyTarget =
    toSection === 'staff' || toSection === 'operations'
      ? propertyNotificationsPath(org.slug, property.slug, toSection)
      : propertySectionPath(org.slug, property.slug, toSection);

  const target = /^\/bookings\/[^/]+$/.test(path)
    ? mapLegacyAdminPath(path, org.slug, property.slug)
    : legacyTarget;

  return <Navigate to={target} replace />;
}
