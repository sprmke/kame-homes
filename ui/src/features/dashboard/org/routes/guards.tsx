import type { ReactNode } from 'react';

import { RouteSkeletonBoundary } from '@/components/skeletons/RouteSkeleton';
import { RequireOrgPermission } from '@/features/dashboard/org/components/RequireOrgPermission';
import { RequireParkingPermission } from '@/features/dashboard/org/components/RequireParkingPermission';
import { RequirePropertyPermission } from '@/features/dashboard/org/components/RequirePropertyPermission';
import { RequirePropertySubscriptionAccess } from '@/features/dashboard/plans/components/RequirePropertySubscriptionAccess';
import type { ORG_SECTION_VIEW_PERMISSION } from '@/features/dashboard/team/lib/orgPermissions';
import type { ParkingSection } from '@/features/dashboard/team/lib/parkingPermissions';
import type { PropertySection } from '@/features/dashboard/team/lib/propertyPermissions';

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

export function propertyRoute(section: PropertySection, element: ReactNode, skeleton: ReactNode) {
  return (
    <RequirePropertyPermission section={section}>
      <RequirePropertySubscriptionAccess section={section}>
        <RouteSkeletonBoundary skeleton={skeleton}>{element}</RouteSkeletonBoundary>
      </RequirePropertySubscriptionAccess>
    </RequirePropertyPermission>
  );
}

export function parkingRoute(section: ParkingSection, element: ReactNode, skeleton: ReactNode) {
  return (
    <RequireParkingPermission section={section}>
      <RouteSkeletonBoundary skeleton={skeleton}>{element}</RouteSkeletonBoundary>
    </RequireParkingPermission>
  );
}

export function orgRoute(section: OrgSection, element: ReactNode, skeleton: ReactNode) {
  return (
    <RequireOrgPermission section={section}>
      <RouteSkeletonBoundary skeleton={skeleton}>{element}</RouteSkeletonBoundary>
    </RequireOrgPermission>
  );
}
