import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Navigate, Route, useParams } from 'react-router-dom';

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

export const superAdminRoutes: ReactNode = (
  <Route path="/admin" element={<SuperAdminShell />}>
    <Route index element={<SuperAdminOverviewPage />} />
    <Route path="developments" element={<SuperAdminDevelopmentsPage />} />
    <Route path="developments/:developmentSlug" element={<SuperAdminDevelopmentDetailPage />} />
    <Route path="approvals" element={<SuperAdminApprovalsPage />} />
    <Route path="support" element={<SuperAdminSupportPage />} />
    <Route path="support/faqs" element={<SuperAdminHelpFaqsPage />} />
    <Route path="playbook" element={<SuperAdminPlaybookArticlesPage />} />
    <Route path="announcements" element={<SuperAdminAnnouncementsPage />} />
    <Route path="hosts" element={<SuperAdminHostsPage />} />
    <Route path="settings" element={<SuperAdminSettingsPage />} />
    <Route path="ai-usage" element={<SuperAdminAiUsagePage />} />
    <Route path="audit" element={<SuperAdminAuditPage />} />
    <Route path="platform-settings" element={<SuperAdminPlatformSettingsPage />} />
    <Route path="pricing/plans" element={<SuperAdminPricingPlansPage />} />
    <Route path="pricing/payment-settings" element={<SuperAdminPaymentSettingsPage />} />
    <Route path="pricing/subscriptions" element={<SuperAdminOrgSubscriptionsPage />} />
    <Route path="parking/payouts" element={<SuperAdminParkingPayoutsPage />} />
    <Route path="properties" element={<SuperAdminPlatformPropertiesPage />} />
    <Route path="hosts/:hostId" element={<SuperAdminHostShell />} />
    <Route path="hosts/:hostId/*" element={<SuperAdminHostLegacySubrouteRedirect />} />
    <Route path="orgs" element={<SuperAdminOrgsPage />} />
    {/* Single-page hub — sections are in-page anchors (`#section-x`), not routes. */}
    <Route path="orgs/:orgSlug" element={<SuperAdminOrgShell />} />
    <Route path="orgs/:orgSlug/*" element={<SuperAdminOrgLegacySubrouteRedirect />} />
  </Route>
);
