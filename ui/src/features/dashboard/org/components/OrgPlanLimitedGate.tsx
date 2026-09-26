import type { ReactNode } from 'react';

import { TenantAccessDenied } from '@/features/dashboard/org/components/TenantAccessDenied';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

type Props = {
  children: ReactNode;
};

/** Full-page plan-limit screen before org admin chrome when the user's org seat is paused. */
export function OrgPlanLimitedGate({ children }: Props) {
  const { data, isPending, isError } = useOrgPermissions();

  if (isPending && !data) {
    return <RouteGuardLoading fullScreen />;
  }

  if (data?.planLimited) {
    return (
      <TenantAccessDenied
        scope="org"
        reason="plan_limited"
        orgSlug={data.orgSlug}
        orgName={data.orgName}
        fullScreen
      />
    );
  }

  // Do not mount AdminLayout on access errors — that fans out notifications / assistant
  // calls and floods the edge logs with 403s for plan-limited or revoked seats.
  if (isError || !data) {
    return <TenantAccessDenied scope="org" fullScreen />;
  }

  return children;
}
