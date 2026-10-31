import type { ReactNode } from 'react';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { TenantAccessDenied } from '@/features/dashboard/org/components/TenantAccessDenied';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

type Props = {
  children: ReactNode;
};

/** Full-page plan-limit screen before property admin chrome when the user's seat is paused. */
export function PropertyPlanLimitedGate({ children }: Props) {
  const { orgSlug } = useOrgContext();
  const { data, isPending, isError } = usePropertyPermissions();

  if (isPending && !data) {
    return <RouteGuardLoading fullScreen />;
  }

  if (data?.planLimited) {
    return (
      <TenantAccessDenied
        scope="property"
        reason="plan_limited"
        orgSlug={orgSlug}
        orgName={data.orgName}
        propertySlug={data.propertySlug}
        propertyName={data.propertyName}
        fullScreen
      />
    );
  }

  if (isError || !data) {
    return <TenantAccessDenied scope="property" orgSlug={orgSlug} fullScreen />;
  }

  return children;
}
