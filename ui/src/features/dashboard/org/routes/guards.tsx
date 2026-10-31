import { Suspense, type ReactNode } from 'react';

import { RequireOrgPermission } from '@/features/dashboard/org/components/RequireOrgPermission';
import { RequireParkingPermission } from '@/features/dashboard/org/components/RequireParkingPermission';
import { RequirePropertyPermission } from '@/features/dashboard/org/components/RequirePropertyPermission';
import { RequirePropertySubscriptionAccess } from '@/features/dashboard/plans/components/RequirePropertySubscriptionAccess';
import type { ORG_SECTION_VIEW_PERMISSION } from '@/features/dashboard/team/lib/orgPermissions';
import type { ParkingSection } from '@/features/dashboard/team/lib/parkingPermissions';
import type { PropertySection } from '@/features/dashboard/team/lib/propertyPermissions';

import { RouteSkeletonProvider } from '@/components/skeletons/RouteSkeleton';

type OrgSection = keyof typeof ORG_SECTION_VIEW_PERMISSION;

export type PropertyRouteFn = (
  section: PropertySection,
  element: ReactNode,
  skeleton: ReactNode
) => ReactNode;
export type ParkingRouteFn = (
  section: ParkingSection,
  element: ReactNode,
  skeleton: ReactNode
) => ReactNode;
export type OrgRouteFn = (
  section: OrgSection,
  element: ReactNode,
  skeleton: ReactNode
) => ReactNode;

/* The provider wraps the permission guards so their `RouteGuardLoading` renders the
 * route skeleton instead of falling back to the branded loader. */

export function propertyRoute(section: PropertySection, element: ReactNode, skeleton: ReactNode) {
  return (
    <RouteSkeletonProvider skeleton={skeleton}>
      <RequirePropertyPermission section={section}>
        <RequirePropertySubscriptionAccess section={section}>
          <Suspense fallback={skeleton}>{element}</Suspense>
        </RequirePropertySubscriptionAccess>
      </RequirePropertyPermission>
    </RouteSkeletonProvider>
  );
}

export function parkingRoute(section: ParkingSection, element: ReactNode, skeleton: ReactNode) {
  return (
    <RouteSkeletonProvider skeleton={skeleton}>
      <RequireParkingPermission section={section}>
        <Suspense fallback={skeleton}>{element}</Suspense>
      </RequireParkingPermission>
    </RouteSkeletonProvider>
  );
}

export function orgRoute(section: OrgSection, element: ReactNode, skeleton: ReactNode) {
  return (
    <RouteSkeletonProvider skeleton={skeleton}>
      <RequireOrgPermission section={section}>
        <Suspense fallback={skeleton}>{element}</Suspense>
      </RequireOrgPermission>
    </RouteSkeletonProvider>
  );
}
