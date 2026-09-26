import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import { hostAnnouncementsOrgRoute } from '@/features/dashboard/announcements/routes';
import { HelpSupportLayout } from '@/features/dashboard/help-support/components/HelpSupportLayout';
import { helpSupportOrgNestedRoutes } from '@/features/dashboard/help-support/routes';
import { OrgInboxRedirect } from '@/features/dashboard/inbox/routes';
import { LegacyAdminRedirect } from '@/features/dashboard/org/components/LegacyAdminRedirect';
import { OrgAdminShell } from '@/features/dashboard/org/components/OrgAdminShell';
import { ParkingAdminShell } from '@/features/dashboard/org/components/ParkingAdminShell';
import { PropertyAdminShell } from '@/features/dashboard/org/components/PropertyAdminShell';
import type { OrgRouteFn } from '@/features/dashboard/org/routes/guards';

import {
  OrgAnalyticsRouteSkeleton,
  OrgBookingsRouteSkeleton,
  OrgDashboardRouteSkeleton,
  OrgHelpSupportRouteSkeleton,
  OrgParkingsRouteSkeleton,
  OrgPlansRouteSkeleton,
  OrgPropertiesRouteSkeleton,
  OrgSettingsRouteSkeleton,
  OrgTeamRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

const ActivityLogRedirect = lazy(() =>
  import('@/features/dashboard/activity/pages/ActivityLogRedirect').then((m) => ({
    default: m.ActivityLogRedirect,
  }))
);
const OrgAnalyticsPage = lazy(() =>
  import('@/features/dashboard/analytics/pages/OrgAnalyticsPage').then((m) => ({
    default: m.OrgAnalyticsPage,
  }))
);
const HostVerificationRejectedRoutePage = lazy(() =>
  import('@/features/dashboard/org/pages/HostVerificationRejectedRoutePage').then((m) => ({
    default: m.HostVerificationRejectedRoutePage,
  }))
);
const OnboardingPage = lazy(() =>
  import('@/features/dashboard/org/pages/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  }))
);
const OrgBookingsPage = lazy(() =>
  import('@/features/dashboard/org/pages/OrgBookingsPage').then((m) => ({
    default: m.OrgBookingsPage,
  }))
);
const OrgDashboardPage = lazy(() =>
  import('@/features/dashboard/org/pages/OrgDashboardPage').then((m) => ({
    default: m.OrgDashboardPage,
  }))
);
const OrgParkingsPage = lazy(() =>
  import('@/features/dashboard/org/pages/OrgParkingsPage').then((m) => ({
    default: m.OrgParkingsPage,
  }))
);
const OrgPropertiesPage = lazy(() =>
  import('@/features/dashboard/org/pages/OrgPropertiesPage').then((m) => ({
    default: m.OrgPropertiesPage,
  }))
);
const OrgSelectorPage = lazy(() =>
  import('@/features/dashboard/org/pages/OrgSelectorPage').then((m) => ({
    default: m.OrgSelectorPage,
  }))
);
const OrgSettingsPage = lazy(() =>
  import('@/features/dashboard/org/pages/OrgSettingsPage').then((m) => ({
    default: m.OrgSettingsPage,
  }))
);
const OrgPlansPage = lazy(() =>
  import('@/features/dashboard/plans/pages/OrgPlansPage').then((m) => ({ default: m.OrgPlansPage }))
);
const OrgTeamPage = lazy(() =>
  import('@/features/dashboard/team/pages/OrgTeamPage').then((m) => ({ default: m.OrgTeamPage }))
);

export const orgOnboardingRoutes: ReactNode = (
  <>
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/org" element={<OrgSelectorPage />} />
    <Route path="/verification-rejected" element={<HostVerificationRejectedRoutePage />} />
  </>
);

export function orgAdminRoutes(orgRoute: OrgRouteFn): ReactNode {
  return (
    <Route path="/org/:orgSlug" element={<OrgAdminShell />}>
      <Route
        path="dashboard"
        element={orgRoute('dashboard', <OrgDashboardPage />, <OrgDashboardRouteSkeleton />)}
      />
      <Route
        path="bookings"
        element={orgRoute('bookings', <OrgBookingsPage />, <OrgBookingsRouteSkeleton />)}
      />
      <Route
        path="settings"
        element={orgRoute('settings', <OrgSettingsPage />, <OrgSettingsRouteSkeleton />)}
      />
      <Route
        path="properties"
        element={orgRoute('properties', <OrgPropertiesPage />, <OrgPropertiesRouteSkeleton />)}
      />
      <Route
        path="parkings"
        element={orgRoute('parkings', <OrgParkingsPage />, <OrgParkingsRouteSkeleton />)}
      />
      <Route path="team" element={orgRoute('team', <OrgTeamPage />, <OrgTeamRouteSkeleton />)} />
      <Route
        path="plans"
        element={orgRoute('plans', <OrgPlansPage />, <OrgPlansRouteSkeleton />)}
      />
      {hostAnnouncementsOrgRoute(orgRoute)}
      <Route
        path="analytics"
        element={orgRoute('analytics', <OrgAnalyticsPage />, <OrgAnalyticsRouteSkeleton />)}
      />
      <Route
        path="activity"
        element={orgRoute(
          'activity',
          <ActivityLogRedirect scope="org" />,
          <OrgSettingsRouteSkeleton />
        )}
      />
      <Route path="inbox" element={<OrgInboxRedirect />} />
      <Route
        path="help-support"
        element={orgRoute('help-support', <HelpSupportLayout />, <OrgHelpSupportRouteSkeleton />)}
      >
        {helpSupportOrgNestedRoutes()}
      </Route>
    </Route>
  );
}

/** @deprecated Use orgAdminRoutes — kept for imports during migration. */
export function orgScopedRoutes(orgRoute: OrgRouteFn): ReactNode {
  return orgAdminRoutes(orgRoute);
}

export function parkingShellRoute(parkingChildren: ReactNode): ReactNode {
  return (
    <Route path="/org/:orgSlug/parking/:parkingSlug" element={<ParkingAdminShell />}>
      {parkingChildren}
    </Route>
  );
}

export function propertyShellRoute(propertyChildren: ReactNode): ReactNode {
  return (
    <Route path="/org/:orgSlug/property/:propertySlug" element={<PropertyAdminShell />}>
      {propertyChildren}
    </Route>
  );
}

export const legacyAdminRedirects: ReactNode = (
  <>
    <Route path="/dashboard" element={<LegacyAdminRedirect toSection="dashboard" />} />
    <Route path="/bookings" element={<LegacyAdminRedirect toSection="bookings" />} />
    <Route path="/bookings/:bookingId" element={<LegacyAdminRedirect toSection="bookings" />} />
    <Route path="/finance" element={<LegacyAdminRedirect toSection="finance" />} />
    <Route path="/maintenance" element={<LegacyAdminRedirect toSection="maintenance" />} />
    <Route path="/notifications" element={<LegacyAdminRedirect toSection="notifications" />} />
    <Route path="/marketing" element={<LegacyAdminRedirect toSection="marketing" />} />
    <Route path="/staff" element={<LegacyAdminRedirect toSection="staff" />} />
    <Route path="/operations" element={<LegacyAdminRedirect toSection="operations" />} />
    <Route path="/settings" element={<LegacyAdminRedirect toSection="settings" />} />
  </>
);
