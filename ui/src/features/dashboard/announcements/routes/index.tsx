import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Navigate, Outlet, Route } from 'react-router-dom';

import {
  hostAnnouncementsPathFromHelpSupport,
  useHasHostAnnouncementsArchiveScope,
} from '@/features/dashboard/announcements/lib/hostAnnouncementsPaths';
import { useHelpSupportBasePath } from '@/features/dashboard/help-support/lib/helpSupportPaths';
import type {
  OrgRouteFn,
  ParkingRouteFn,
  PropertyRouteFn,
} from '@/features/dashboard/org/routes/guards';

const HostAnnouncementDetailPage = lazy(() =>
  import('@/features/dashboard/announcements/pages/HostAnnouncementDetailPage').then((m) => ({
    default: m.HostAnnouncementDetailPage,
  }))
);
const HostAnnouncementsListPage = lazy(() =>
  import('@/features/dashboard/announcements/pages/HostAnnouncementsListPage').then((m) => ({
    default: m.HostAnnouncementsListPage,
  }))
);

function HelpSupportAnnouncementsRedirect() {
  const helpSupportPath = useHelpSupportBasePath();
  const hasArchive = useHasHostAnnouncementsArchiveScope();

  if (!helpSupportPath) {
    return <Navigate to=".." replace />;
  }

  if (!hasArchive) {
    return <Navigate to={helpSupportPath} replace />;
  }

  return <Navigate to={hostAnnouncementsPathFromHelpSupport(helpSupportPath)} replace />;
}

function hostAnnouncementsNestedRoutes(): ReactNode {
  return (
    <>
      <Route index element={<HostAnnouncementsListPage />} />
      <Route path=":announcementId" element={<HostAnnouncementDetailPage />} />
    </>
  );
}

export function hostAnnouncementsOrgRoute(orgRoute: OrgRouteFn): ReactNode {
  return (
    <Route path="announcements" element={orgRoute('announcements', <Outlet />)}>
      {hostAnnouncementsNestedRoutes()}
    </Route>
  );
}

/** Deep-link fallback for property-only members (no org-hub nav entry). */
export function hostAnnouncementsPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <Route path="announcements" element={propertyRoute('announcements', <Outlet />)}>
      {hostAnnouncementsNestedRoutes()}
    </Route>
  );
}

/** Deep-link fallback for parking team members (no org-hub nav entry). */
export function hostAnnouncementsParkingRoute(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <Route path="announcements" element={parkingRoute('announcements', <Outlet />)}>
      {hostAnnouncementsNestedRoutes()}
    </Route>
  );
}

export function helpSupportAnnouncementsRedirectRoute(): ReactNode {
  return <Route path="announcements" element={<HelpSupportAnnouncementsRedirect />} />;
}
