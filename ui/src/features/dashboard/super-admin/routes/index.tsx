import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Navigate, Route, useParams } from 'react-router-dom';

import { RouteSkeletonBoundary } from '@/components/skeletons/RouteSkeleton';
import {
  GenericAdminRouteSkeleton,
  SuperAdminAuditRouteSkeleton,
  SuperAdminHostShellRouteSkeleton,
  SuperAdminListRouteSkeleton,
  SuperAdminOrgShellRouteSkeleton,
  SuperAdminOverviewRouteSkeleton,
  SuperAdminSettingsRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

import { SuperAdminHostShell } from '@/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostShell';
import { SuperAdminOrgShell } from '@/features/dashboard/super-admin/components/super-admin-orgs/SuperAdminOrgShell';
import { SuperAdminShell } from '@/features/dashboard/super-admin/components/SuperAdminShell';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

const SuperAdminAiUsagePage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminAiUsagePage').then((m) => ({
    default: m.SuperAdminAiUsagePage,
  }))
);
const SuperAdminAnnouncementsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminAnnouncementsPage').then((m) => ({
    default: m.SuperAdminAnnouncementsPage,
  }))
);
const SuperAdminApprovalsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminApprovalsPage').then((m) => ({
    default: m.SuperAdminApprovalsPage,
  }))
);
const SuperAdminAuditPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminAuditPage').then((m) => ({
    default: m.SuperAdminAuditPage,
  }))
);
const SuperAdminDevelopmentDetailPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminDevelopmentDetailPage').then((m) => ({
    default: m.SuperAdminDevelopmentDetailPage,
  }))
);
const SuperAdminDevelopmentsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminDevelopmentsPage').then((m) => ({
    default: m.SuperAdminDevelopmentsPage,
  }))
);
const SuperAdminHelpFaqsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminHelpFaqsPage').then((m) => ({
    default: m.SuperAdminHelpFaqsPage,
  }))
);
const SuperAdminHostsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminHostsPage').then((m) => ({
    default: m.SuperAdminHostsPage,
  }))
);
const SuperAdminOrgsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminOrgsPage').then((m) => ({
    default: m.SuperAdminOrgsPage,
  }))
);
const SuperAdminOrgSubscriptionsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminOrgSubscriptionsPage').then((m) => ({
    default: m.SuperAdminOrgSubscriptionsPage,
  }))
);
const SuperAdminOverviewPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminOverviewPage').then((m) => ({
    default: m.SuperAdminOverviewPage,
  }))
);
const SuperAdminParkingPayoutsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminParkingPayoutsPage').then((m) => ({
    default: m.SuperAdminParkingPayoutsPage,
  }))
);
const SuperAdminPaymentSettingsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminPaymentSettingsPage').then((m) => ({
    default: m.SuperAdminPaymentSettingsPage,
  }))
);
const SuperAdminPlatformPropertiesPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminPlatformPropertiesPage').then((m) => ({
    default: m.SuperAdminPlatformPropertiesPage,
  }))
);
const SuperAdminPlatformSettingsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminPlatformSettingsPage').then((m) => ({
    default: m.SuperAdminPlatformSettingsPage,
  }))
);
const SuperAdminPlaybookArticlesPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminPlaybookArticlesPage').then((m) => ({
    default: m.SuperAdminPlaybookArticlesPage,
  }))
);
const SuperAdminPricingPlansPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminPricingPlansPage').then((m) => ({
    default: m.SuperAdminPricingPlansPage,
  }))
);
const SuperAdminRateLimitsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminRateLimitsPage').then((m) => ({
    default: m.SuperAdminRateLimitsPage,
  }))
);
const SuperAdminSettingsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminSettingsPage').then((m) => ({
    default: m.SuperAdminSettingsPage,
  }))
);
const SuperAdminSupportPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminSupportPage').then((m) => ({
    default: m.SuperAdminSupportPage,
  }))
);

/** Any old sub-route under an org (`…/properties`, pre-overhaul `…/subscription`, etc.) now
 *  lands on the hub itself — sections are in-page anchors, not routes. */
function SuperAdminOrgLegacySubrouteRedirect() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  return <Navigate to={superAdminPaths.organizationHub(orgSlug)} replace />;
}

/** Old `/orgs` and `/orgs/properties` sub-routes (pre-dropdown-filter redesign) now land on the
 *  host detail page itself — Organizations vs. Properties is a dropdown, not a route. */
function SuperAdminHostLegacySubrouteRedirect() {
  const { hostId = '' } = useParams<{ hostId: string }>();
  return <Navigate to={superAdminPaths.hostDetail(hostId)} replace />;
}

function superAdminRoute(page: ReactNode, skeleton: ReactNode) {
  return <RouteSkeletonBoundary skeleton={skeleton}>{page}</RouteSkeletonBoundary>;
}

export const superAdminRoutes: ReactNode = (
  <Route path="/admin" element={<SuperAdminShell />}>
    <Route
      index
      element={superAdminRoute(<SuperAdminOverviewPage />, <SuperAdminOverviewRouteSkeleton />)}
    />
    <Route
      path="developments"
      element={superAdminRoute(<SuperAdminDevelopmentsPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="developments/:developmentSlug"
      element={superAdminRoute(<SuperAdminDevelopmentDetailPage />, <GenericAdminRouteSkeleton />)}
    />
    <Route
      path="approvals"
      element={superAdminRoute(<SuperAdminApprovalsPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="support"
      element={superAdminRoute(<SuperAdminSupportPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="support/faqs"
      element={superAdminRoute(<SuperAdminHelpFaqsPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="playbook"
      element={superAdminRoute(<SuperAdminPlaybookArticlesPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="announcements"
      element={superAdminRoute(<SuperAdminAnnouncementsPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="hosts"
      element={superAdminRoute(<SuperAdminHostsPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="settings"
      element={superAdminRoute(<SuperAdminSettingsPage />, <SuperAdminSettingsRouteSkeleton />)}
    />
    <Route
      path="ai-usage"
      element={superAdminRoute(<SuperAdminAiUsagePage />, <SuperAdminOverviewRouteSkeleton />)}
    />
    <Route
      path="rate-limits"
      element={superAdminRoute(<SuperAdminRateLimitsPage />, <SuperAdminSettingsRouteSkeleton />)}
    />
    <Route
      path="audit"
      element={superAdminRoute(<SuperAdminAuditPage />, <SuperAdminAuditRouteSkeleton />)}
    />
    <Route
      path="platform-settings"
      element={superAdminRoute(
        <SuperAdminPlatformSettingsPage />,
        <SuperAdminSettingsRouteSkeleton />
      )}
    />
    <Route
      path="pricing/plans"
      element={superAdminRoute(<SuperAdminPricingPlansPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="pricing/payment-settings"
      element={superAdminRoute(
        <SuperAdminPaymentSettingsPage />,
        <SuperAdminSettingsRouteSkeleton />
      )}
    />
    <Route
      path="pricing/subscriptions"
      element={superAdminRoute(<SuperAdminOrgSubscriptionsPage />, <SuperAdminListRouteSkeleton />)}
    />
    <Route
      path="parking/payouts"
      element={superAdminRoute(
        <SuperAdminParkingPayoutsPage />,
        <SuperAdminSettingsRouteSkeleton />
      )}
    />
    <Route
      path="properties"
      element={superAdminRoute(
        <SuperAdminPlatformPropertiesPage />,
        <SuperAdminListRouteSkeleton />
      )}
    />
    <Route
      path="hosts/:hostId"
      element={superAdminRoute(<SuperAdminHostShell />, <SuperAdminHostShellRouteSkeleton />)}
    />
    <Route path="hosts/:hostId/*" element={<SuperAdminHostLegacySubrouteRedirect />} />
    <Route
      path="orgs"
      element={superAdminRoute(<SuperAdminOrgsPage />, <SuperAdminListRouteSkeleton />)}
    />
    {/* Single-page hub — sections are in-page anchors (`#section-x`), not routes. */}
    <Route
      path="orgs/:orgSlug"
      element={superAdminRoute(<SuperAdminOrgShell />, <SuperAdminOrgShellRouteSkeleton />)}
    />
    <Route path="orgs/:orgSlug/*" element={<SuperAdminOrgLegacySubrouteRedirect />} />
  </Route>
);
