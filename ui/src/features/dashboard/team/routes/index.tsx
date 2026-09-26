import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type {
  OrgRouteFn,
  ParkingRouteFn,
  PropertyRouteFn,
} from '@/features/dashboard/org/routes/guards';

import {
  OrgTeamRouteSkeleton,
  ParkingTeamRouteSkeleton,
  PropertyTeamRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

const AcceptInvitePage = lazy(() =>
  import('@/features/dashboard/team/pages/AcceptInvitePage').then((m) => ({
    default: m.AcceptInvitePage,
  }))
);
const OrgTeamPage = lazy(() =>
  import('@/features/dashboard/team/pages/OrgTeamPage').then((m) => ({ default: m.OrgTeamPage }))
);
const ParkingTeamPage = lazy(() =>
  import('@/features/dashboard/team/pages/ParkingTeamPage').then((m) => ({
    default: m.ParkingTeamPage,
  }))
);
const PropertyTeamPage = lazy(() =>
  import('@/features/dashboard/team/pages/PropertyTeamPage').then((m) => ({
    default: m.PropertyTeamPage,
  }))
);

export const teamAuthRoutes: ReactNode = (
  <Route key="accept-invite" path="/accept-invite" element={<AcceptInvitePage />} />
);

export function orgTeamRoute(orgRoute: OrgRouteFn): ReactNode {
  return (
    <Route
      path="/org/:orgSlug/team"
      element={orgRoute('team', <OrgTeamPage />, <OrgTeamRouteSkeleton />)}
    />
  );
}

export function propertyTeamRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <Route
      path="team"
      element={propertyRoute('team', <PropertyTeamPage />, <PropertyTeamRouteSkeleton />)}
    />
  );
}

export function parkingTeamRoute(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <Route
      path="team"
      element={parkingRoute('team', <ParkingTeamPage />, <ParkingTeamRouteSkeleton />)}
    />
  );
}
