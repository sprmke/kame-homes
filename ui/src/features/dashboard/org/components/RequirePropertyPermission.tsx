import type { ReactNode } from 'react';

import { Navigate } from 'react-router-dom';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { TenantAccessDenied } from '@/features/dashboard/org/components/TenantAccessDenied';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import {
  hasPropertyPermission,
  PROPERTY_SECTION_VIEW_PERMISSION,
  type PropertySection,
} from '@/features/dashboard/team/lib/propertyPermissions';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

type Props = {
  section: PropertySection;
  children: ReactNode;
};

export function RequirePropertyPermission({ section, children }: Props) {
  const { orgSlug, propertySlug } = useOrgContext();
  const { data, isLoading, isError } = usePropertyPermissions();

  if (isLoading) {
    return <RouteGuardLoading />;
  }

  if (data?.planLimited) {
    return (
      <TenantAccessDenied
        scope="property"
        reason="plan_limited"
        orgSlug={orgSlug}
        orgName={data.orgName}
        propertySlug={propertySlug}
        propertyName={data.propertyName}
      />
    );
  }

  // Help & Support and Announcements are baseline access for every active property member (plan intent).
  if ((section === 'help-support' || section === 'announcements') && data && !data.planLimited) {
    return children;
  }

  if (isError || !data || !canViewPropertySection(data.permissions, section)) {
    const fallback = findFirstAllowedSection(data?.permissions);
    if (fallback) {
      return <Navigate to={propertySectionPath(orgSlug, propertySlug, fallback)} replace />;
    }
    return (
      <TenantAccessDenied
        scope="property"
        orgSlug={orgSlug}
        propertySlug={propertySlug}
        propertyName={data?.propertyName}
      />
    );
  }

  return children;
}

const PROPERTY_SECTION_ORDER: readonly PropertySection[] = [
  'dashboard',
  'bookings',
  'finance',
  'pricing',
  'analytics',
  'maintenance',
  'marketing',
  'inbox',
  'notifications',
  'templates',
  'public-pages',
  'plans',
  'team',
  'settings',
];

function findFirstAllowedSection(
  permissions: readonly string[] | undefined
): PropertySection | null {
  if (!permissions?.length) return null;
  for (const section of PROPERTY_SECTION_ORDER) {
    if (canViewPropertySection(permissions, section)) {
      return section;
    }
  }
  return null;
}

function canViewPropertySection(
  permissions: readonly string[] | undefined,
  section: PropertySection
): boolean {
  return hasPropertyPermission(permissions, PROPERTY_SECTION_VIEW_PERMISSION[section]);
}
