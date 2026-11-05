import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

import { Navigate, Route, useParams } from 'react-router-dom';

import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { RouteSkeletonBoundary } from '@/components/skeletons/RouteSkeleton';
import {
  SuperAdminAiRouteSkeleton,
  SuperAdminAuditRouteSkeleton,
  SuperAdminDevelopmentDetailRouteSkeleton,
  SuperAdminHealthRouteSkeleton,
  SuperAdminHostShellRouteSkeleton,
  SuperAdminListRouteSkeleton,
  SuperAdminOpsReportDetailRouteSkeleton,
  SuperAdminOpsReportsRouteSkeleton,
  SuperAdminOrgShellRouteSkeleton,
  SuperAdminOverviewRouteSkeleton,
  SuperAdminParkingPayoutsRouteSkeleton,
  SuperAdminRateLimitsRouteSkeleton,
  SuperAdminSettingsRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

/** Shells pull in approval dialogs (pdf.js) and the admin layout; keep them out of the guest entry chunk. */
const SuperAdminShell = lazy(() =>
  import('@/features/dashboard/super-admin/components/SuperAdminShell').then((m) => ({
    default: m.SuperAdminShell,
  }))
);
const SuperAdminHostShell = lazy(() =>
  import('@/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostShell').then(
    (m) => ({ default: m.SuperAdminHostShell })
  )
);
const SuperAdminOrgShell = lazy(() =>
  import('@/features/dashboard/super-admin/components/super-admin-orgs/SuperAdminOrgShell').then(
    (m) => ({ default: m.SuperAdminOrgShell })
  )
);

const SuperAdminAiPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminAiPage').then((m) => ({
    default: m.SuperAdminAiPage,
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
const SuperAdminHealthPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminHealthPage').then((m) => ({
    default: m.SuperAdminHealthPage,
  }))
);
const SuperAdminOpsReportsPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminOpsReportsPage').then((m) => ({
    default: m.SuperAdminOpsReportsPage,
  }))
);
const SuperAdminOpsReportDetailPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminOpsReportDetailPage').then((m) => ({
    default: m.SuperAdminOpsReportDetailPage,
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
const SuperAdminFeatureAvailabilityPage = lazy(() =>
  import('@/features/dashboard/super-admin/pages/SuperAdminFeatureAvailabilityPage').then((m) => ({
    default: m.SuperAdminFeatureAvailabilityPage,
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
  <Route
    path="/admin"
    element={
      <Suspense fallback={<RouteGuardSkeleton fullScreen />}>
        <SuperAdminShell />
      </Suspense>
    }
  >
    <Route
      index
      element={superAdminRoute(<SuperAdminOverviewPage />, <SuperAdminOverviewRouteSkeleton />)}
    />
    <Route
      path="developments"
      element={superAdminRoute(
        <SuperAdminDevelopmentsPage />,
        <SuperAdminListRouteSkeleton
          title="Developments"
          subtitle="Buildings and developments on the platform."
          withActions={1}
          metricTitles={['Total developments', 'Active', 'Linked properties', 'Linked parking']}
        />
      )}
    />
    <Route
      path="developments/:developmentSlug"
      element={superAdminRoute(
        <SuperAdminDevelopmentDetailPage />,
        <SuperAdminDevelopmentDetailRouteSkeleton />
      )}
    />
    <Route
      path="approvals"
      element={superAdminRoute(
        <SuperAdminApprovalsPage />,
        <SuperAdminListRouteSkeleton
          title="Approvals"
          subtitle="Review host verification requests."
          metricTitles={['In review', 'Org verifications', 'Listing verifications', 'Reviews']}
        />
      )}
    />
    <Route
      path="support"
      element={superAdminRoute(
        <SuperAdminSupportPage />,
        <SuperAdminListRouteSkeleton
          title="Support tickets"
          subtitle="Host bug reports, suggestions, and inquiries."
          metricTitles={['Total tickets', 'Open', 'In progress', 'Resolved']}
        />
      )}
    />
    <Route
      path="support/faqs"
      element={superAdminRoute(
        <SuperAdminHelpFaqsPage />,
        <SuperAdminListRouteSkeleton
          title="FAQs"
          subtitle="Curated FAQs shown to hosts."
          withActions={1}
          metricTitles={['Total FAQs', 'Published', 'Unpublished', 'Categories']}
          view="grouped"
        />
      )}
    />
    <Route
      path="playbook"
      element={superAdminRoute(
        <SuperAdminPlaybookArticlesPage />,
        <SuperAdminListRouteSkeleton
          title="Improvement Playbook"
          subtitle="Curated tips matched against Analytics and linked from the AI Performance Review."
          withActions={1}
          metricCount={0}
          metricTitles={[]}
          view="grouped"
        />
      )}
    />
    <Route
      path="announcements"
      element={superAdminRoute(
        <SuperAdminAnnouncementsPage />,
        <SuperAdminListRouteSkeleton
          title="Announcements"
          subtitle="Platform-wide notices shown to every signed-in host."
          withActions={1}
          metricTitles={['Total announcements', 'Active', 'Critical', 'Warning']}
        />
      )}
    />
    <Route
      path="hosts"
      element={superAdminRoute(
        <SuperAdminHostsPage />,
        <SuperAdminListRouteSkeleton
          title="Hosts"
          subtitle="All hosts on the platform."
          metricTitles={['Total hosts', 'Organizations', 'Properties', 'Parking slots']}
        />
      )}
    />
    <Route
      path="ai"
      element={superAdminRoute(<SuperAdminAiPage />, <SuperAdminAiRouteSkeleton />)}
    />
    <Route path="settings" element={<Navigate to={superAdminPaths.aiTab('controls')} replace />} />
    <Route path="ai-usage" element={<Navigate to={superAdminPaths.aiTab('usage')} replace />} />
    <Route
      path="rate-limits"
      element={superAdminRoute(<SuperAdminRateLimitsPage />, <SuperAdminRateLimitsRouteSkeleton />)}
    />
    <Route
      path="health"
      element={superAdminRoute(<SuperAdminHealthPage />, <SuperAdminHealthRouteSkeleton />)}
    />
    <Route
      path="health/:section"
      element={superAdminRoute(<SuperAdminHealthPage />, <SuperAdminHealthRouteSkeleton />)}
    />
    <Route
      path="ops-reports"
      element={superAdminRoute(<SuperAdminOpsReportsPage />, <SuperAdminOpsReportsRouteSkeleton />)}
    />
    <Route
      path="ops-reports/:reportId"
      element={superAdminRoute(
        <SuperAdminOpsReportDetailPage />,
        <SuperAdminOpsReportDetailRouteSkeleton />
      )}
    />
    <Route
      path="ops-reports"
      element={superAdminRoute(
        <SuperAdminOpsReportsPage />,
        <SuperAdminOpsReportsRouteSkeleton />
      )}
    />
    <Route
      path="ops-reports/:reportId"
      element={superAdminRoute(
        <SuperAdminOpsReportDetailPage />,
        <SuperAdminOpsReportDetailRouteSkeleton />
      )}
    />
    <Route
      path="audit"
      element={superAdminRoute(<SuperAdminAuditPage />, <SuperAdminAuditRouteSkeleton />)}
    />
    <Route
      path="platform-settings"
      element={superAdminRoute(
        <SuperAdminPlatformSettingsPage />,
        <SuperAdminSettingsRouteSkeleton
          title="Platform settings"
          subtitle="Operational knobs for the whole platform. Changes take effect on the next request that reads them."
        />
      )}
    />
    <Route
      path="feature-availability"
      element={superAdminRoute(
        <SuperAdminFeatureAvailabilityPage />,
        <SuperAdminSettingsRouteSkeleton
          title="Feature availability"
          subtitle="Turn product areas off for hosts with a reason, optional banner, and super-admin bypass."
          cards={4}
        />
      )}
    />
    <Route
      path="pricing/plans"
      element={superAdminRoute(
        <SuperAdminPricingPlansPage />,
        <SuperAdminListRouteSkeleton
          title="Pricing plans"
          subtitle="Subscription tier catalog for host Plans & Billing."
          metricTitles={['Total plans', 'Host tiers', 'Active plans', 'Default plan']}
        />
      )}
    />
    <Route
      path="pricing/payment-settings"
      element={superAdminRoute(
        <SuperAdminPaymentSettingsPage />,
        <SuperAdminSettingsRouteSkeleton
          title="Payment settings"
          subtitle="Subscription checkout rails and renewal timing for host billing."
          cards={1}
        />
      )}
    />
    <Route
      path="pricing/subscriptions"
      element={superAdminRoute(
        <SuperAdminOrgSubscriptionsPage />,
        <SuperAdminListRouteSkeleton
          title="Org subscriptions"
          subtitle="Assign plans to organizations across the platform. Covers every property they own."
          withActions={2}
          metricTitles={['Organizations', 'Assigned', 'Unassigned', 'Properties']}
        />
      )}
    />
    <Route
      path="parking/payouts"
      element={superAdminRoute(
        <SuperAdminParkingPayoutsPage />,
        <SuperAdminParkingPayoutsRouteSkeleton />
      )}
    />
    <Route
      path="properties"
      element={superAdminRoute(
        <SuperAdminPlatformPropertiesPage />,
        <SuperAdminListRouteSkeleton
          title="Properties"
          subtitle="All properties across the platform."
          metricTitles={['Total properties', 'Active', 'Linked developments', 'Organizations']}
        />
      )}
    />
    <Route
      path="hosts/:hostId"
      element={superAdminRoute(<SuperAdminHostShell />, <SuperAdminHostShellRouteSkeleton />)}
    />
    <Route path="hosts/:hostId/*" element={<SuperAdminHostLegacySubrouteRedirect />} />
    <Route
      path="orgs"
      element={superAdminRoute(
        <SuperAdminOrgsPage />,
        <SuperAdminListRouteSkeleton
          title="Organizations"
          subtitle="Every organization on the platform. Open one to manage its subscription, listings, team, approvals, and support."
          metricTitles={['Organizations', 'With a plan', 'Properties', 'Parkings']}
        />
      )}
    />
    {/* Single-page hub - sections are in-page anchors (`#section-x`), not routes. */}
    <Route
      path="orgs/:orgSlug"
      element={superAdminRoute(<SuperAdminOrgShell />, <SuperAdminOrgShellRouteSkeleton />)}
    />
    <Route path="orgs/:orgSlug/*" element={<SuperAdminOrgLegacySubrouteRedirect />} />
  </Route>
);
