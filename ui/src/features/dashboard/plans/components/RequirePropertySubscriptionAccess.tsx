import type { ReactNode } from 'react';

import { Navigate, useLocation } from 'react-router-dom';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { orgPlansPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyEntitlements } from '@/features/dashboard/plans/hooks/usePropertyEntitlements';
import type { PropertySection } from '@/features/dashboard/team/lib/propertyPermissions';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

/** Suspended orgs keep Plans & Billing + Help reachable so hosts can pay or get support. */
const ALLOWED_WHEN_SUSPENDED: PropertySection[] = ['announcements', 'help-support'];

type Props = {
  section: PropertySection;
  children: ReactNode;
};

export function RequirePropertySubscriptionAccess({ section, children }: Props) {
  const { orgSlug } = useOrgContext();
  const location = useLocation();
  const { data, isLoading } = usePropertyEntitlements();

  if (isLoading && !data) {
    return <RouteGuardLoading />;
  }

  const status = data?.status;
  const isSuspended = status === 'suspended';
  const isPastDue = status === 'past_due';
  const plansPath = orgPlansPath(orgSlug);

  if (isSuspended && !ALLOWED_WHEN_SUSPENDED.includes(section)) {
    if (location.pathname !== plansPath) {
      return <Navigate to={plansPath} replace />;
    }
  }

  return (
    <>
      {isPastDue ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive mb-3 rounded-xl border px-3 py-2 text-sm">
          Subscription past due — pay from Plans & Billing before access is restricted.
        </div>
      ) : null}
      {children}
    </>
  );
}
