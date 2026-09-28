/**
 * Eager route-chunk fallbacks. Import only lightweight skeleton markup here (page chrome
 * such as `AdminMobilePage` is fine: the admin shell already loads it).
 */
import { useLocation, useSearchParams } from 'react-router-dom';

import { HOST_ANNOUNCEMENTS_PAGE_SUBTITLE } from '@/features/dashboard/announcements/lib/hostAnnouncementCopy';
import { helpSupportSectionFromPath } from '@/features/dashboard/help-support/lib/helpSupportPaths';
import { useOrgListingSkeletonView } from '@/features/dashboard/org/hooks/useOrgListingSkeletonView';
import { PLANS_PAGE_SUBTITLE } from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel, FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import {
  AdminListToolbarSkeleton,
  AppSettingsNavLayoutSkeleton,
  BookingsCalendarSkeleton,
  BookingsCardGridSkeleton,
  BookingsTableSkeleton,
  BookingDetailPageSkeleton,
  DashboardSkeleton,
  FinanceOverviewSkeleton,
  FinanceStaysTableSkeleton,
  HostOrgCardGridSkeleton,
  ListingCardGridSkeleton,
  ListRowsSkeleton,
  MaintenanceOverviewSkeleton,
  MarketingStudioSkeleton,
  OrgDashboardSkeleton,
  PageEditorSkeleton,
  PlansPageSkeleton,
  SectionContentSkeleton,
  TeamPageSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { GuestFormPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import {
  OrgAnalyticsSkeleton,
  PropertyAnalyticsSkeleton,
} from '@/components/skeletons/AnalyticsSkeleton';
import { HostAnnouncementsBodySkeleton } from '@/components/skeletons/AnnouncementsSkeleton';
import { BookingsStageSummarySkeleton } from '@/components/skeletons/BookingsExtrasSkeleton';
import {
  DevelopmentDetailPageSkeleton,
  GuestAccountGateSkeleton,
  PropertyChatPageSkeleton,
} from '@/components/skeletons/GuestMarketingSkeleton';
import {
  HelpDocumentationTopicsSkeleton,
  HelpSupportPageSkeleton,
} from '@/components/skeletons/HelpSupportSkeleton';
import { OrgListingPageSkeleton } from '@/components/skeletons/OrgListingSkeleton';
import {
  ParkingDashboardSkeleton,
  ParkingBookingDetailSkeleton,
} from '@/components/skeletons/ParkingSkeleton';
import { PricingPageBodySkeleton } from '@/components/skeletons/PricingSkeleton';
import {
  SuperAdminAdminListBodySkeleton,
  SuperAdminAuditBodySkeleton,
  SuperAdminOverviewBodySkeleton,
} from '@/components/skeletons/SuperAdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** `BookingDateRangeFilter` in the hero overlap (phone). */
function DateFilterOverlapSkeleton() {
  return (
    <FloatingToolbar>
      <Skeleton className="h-9 w-full rounded-lg sm:h-10" />
    </FloatingToolbar>
  );
}

/** `BookingDateRangeFilter` in the desktop header actions. */
function DateFilterDesktopSkeleton() {
  return <Skeleton className="h-11 w-full rounded-lg sm:w-60" />;
}

/* Org route skeletons render the page's own `AdminMobilePage` chrome (same title, subtitle
 * and density) so the hero and header do not jump when the chunk resolves. */

export function OrgDashboardRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Dashboard"
      subtitle="Performance across all properties."
      titleId="org-dashboard-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={<DateFilterDesktopSkeleton />}
      desktopActionsClassName="w-full sm:w-auto"
      dense
      className="min-w-0 max-w-full"
    >
      <OrgDashboardSkeleton />
    </AdminMobilePage>
  );
}

export function OrgBookingsRouteSkeleton() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  return (
    <AdminMobilePage
      title="Bookings"
      subtitle="Property stays and parking reservations across your organization."
      titleId="bookings-heading"
      dense
    >
      <BookingsStageSummarySkeleton />
      <AdminListToolbarSkeleton sort />
      {view === 'calendar' ? (
        <FloatingPanel padding="md" className="overflow-hidden">
          <BookingsCalendarSkeleton />
        </FloatingPanel>
      ) : view === 'card' ? (
        <BookingsCardGridSkeleton />
      ) : (
        <>
          <div className="hidden lg:block">
            <BookingsTableSkeleton />
          </div>
          <div className="lg:hidden">
            <BookingsCardGridSkeleton />
          </div>
        </>
      )}
    </AdminMobilePage>
  );
}

export function OrgSettingsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Settings"
      subtitle="Manage your organization's profile, billing, and preferences."
      titleId="org-settings-heading"
      className="flex min-h-0 flex-1 flex-col"
    >
      <AppSettingsNavLayoutSkeleton />
    </AdminMobilePage>
  );
}

export function OrgPropertiesRouteSkeleton() {
  const view = useOrgListingSkeletonView('properties');
  return (
    <AdminMobilePage
      title="Properties"
      subtitle="All properties in your organization."
      titleId="org-properties-heading"
      dense
    >
      <OrgListingPageSkeleton view={view} label="Loading properties" />
    </AdminMobilePage>
  );
}

export function OrgParkingsRouteSkeleton() {
  const view = useOrgListingSkeletonView('parkings');
  return (
    <AdminMobilePage
      title="Parkings"
      subtitle="All parking slots in your organization."
      titleId="org-parkings-heading"
      dense
    >
      <OrgListingPageSkeleton view={view} label="Loading parkings" />
    </AdminMobilePage>
  );
}

export function OrgTeamRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Team"
      subtitle="Manage your organization's team members and permissions."
    >
      <TeamPageSkeleton />
    </AdminMobilePage>
  );
}

export function OrgPlansRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Plans & Billing"
      subtitle={PLANS_PAGE_SUBTITLE}
      titleId="org-plans-heading"
      dense
      className="min-w-0 max-w-full"
    >
      <PlansPageSkeleton />
    </AdminMobilePage>
  );
}

export function OrgAnalyticsRouteSkeleton() {
  const view = useOrgListingSkeletonView('listings');
  return (
    <AdminMobilePage
      title="Analytics"
      titleId="org-analytics-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={<DateFilterDesktopSkeleton />}
      desktopActionsClassName="w-full sm:w-auto"
      dense
      className="min-w-0 max-w-full"
    >
      <OrgAnalyticsSkeleton view={view} />
    </AdminMobilePage>
  );
}

/** Help & Support is the same layout in org, property and parking scope. */
export function OrgHelpSupportRouteSkeleton() {
  const { pathname } = useLocation();
  const section = helpSupportSectionFromPath(pathname);
  return (
    <AdminMobilePage
      title="Help & Support"
      subtitle="Find answers or write to our team."
      titleId="help-support-heading"
      className={section === 'tickets' ? 'flex min-h-0 flex-1 flex-col' : undefined}
    >
      <HelpSupportPageSkeleton section={section} />
    </AdminMobilePage>
  );
}

export function PropertyDashboardRouteSkeleton() {
  return <DashboardSkeleton />;
}

export function PropertyBookingsRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <BookingsStageSummarySkeleton />
      <BookingsTableSkeleton />
    </div>
  );
}

export function PropertyBookingDetailRouteSkeleton() {
  return <BookingDetailPageSkeleton />;
}

export function PropertyNotificationsRouteSkeleton() {
  return <ListRowsSkeleton rows={6} label="Loading notifications" />;
}

export function PropertyTemplatesRouteSkeleton() {
  return <SectionContentSkeleton rows={5} className="space-y-4" />;
}

export function PropertySettingsRouteSkeleton() {
  return <AppSettingsNavLayoutSkeleton />;
}

export function PropertyFinanceRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <FinanceOverviewSkeleton />
      <FinanceStaysTableSkeleton />
    </div>
  );
}

export function PropertyMaintenanceRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <MaintenanceOverviewSkeleton />
      <FinanceStaysTableSkeleton />
    </div>
  );
}

export function PropertyPricingRouteSkeleton() {
  return <PricingPageBodySkeleton />;
}

export function PropertyAnalyticsRouteSkeleton() {
  return <PropertyAnalyticsSkeleton />;
}

export function PropertyMarketingRouteSkeleton() {
  return <MarketingStudioSkeleton />;
}

export function PropertyTeamRouteSkeleton() {
  return <TeamPageSkeleton />;
}

export function PropertyInboxRouteSkeleton() {
  return (
    <div className="flex min-h-[20rem] flex-col gap-3 lg:flex-row">
      <div className="lg:w-80">
        <ListRowsSkeleton rows={6} label="Loading conversations" />
      </div>
      <div className="hidden min-h-0 flex-1 lg:block">
        <SectionContentSkeleton rows={8} />
      </div>
    </div>
  );
}

export function PropertyCustomPagesRouteSkeleton() {
  return <ListingCardGridSkeleton count={4} hideStats label="Loading pages" />;
}

export function PropertyPageEditorRouteSkeleton() {
  return <PageEditorSkeleton />;
}

/** Host announcements list / detail (same chrome in org, property and parking scope). */
export function HostAnnouncementsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Announcements"
      subtitle={HOST_ANNOUNCEMENTS_PAGE_SUBTITLE}
      titleId="host-announcements-heading"
    >
      <HostAnnouncementsBodySkeleton />
    </AdminMobilePage>
  );
}

export function PropertyHelpSupportRouteSkeleton() {
  return <OrgHelpSupportRouteSkeleton />;
}

export function PropertyHelpDocsRouteSkeleton() {
  return <HelpDocumentationTopicsSkeleton />;
}

export function ParkingDashboardRouteSkeleton() {
  return <ParkingDashboardSkeleton />;
}

export function ParkingBookingsRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <BookingsStageSummarySkeleton />
      <BookingsTableSkeleton />
    </div>
  );
}

export function ParkingBookingDetailRouteSkeleton() {
  return <ParkingBookingDetailSkeleton />;
}

export function ParkingFinanceRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <FinanceOverviewSkeleton />
      <FinanceStaysTableSkeleton />
    </div>
  );
}

export function ParkingPricingRouteSkeleton() {
  return <PricingPageBodySkeleton />;
}

export function ParkingNotificationsRouteSkeleton() {
  return <ListRowsSkeleton rows={5} label="Loading notifications" />;
}

export function ParkingSettingsRouteSkeleton() {
  return <AppSettingsNavLayoutSkeleton />;
}

export function ParkingInboxRouteSkeleton() {
  return <PropertyInboxRouteSkeleton />;
}

export function ParkingTeamRouteSkeleton() {
  return <TeamPageSkeleton />;
}

export function SuperAdminOverviewRouteSkeleton() {
  return <SuperAdminOverviewBodySkeleton metricCount={9} />;
}

export function SuperAdminListRouteSkeleton() {
  return <SuperAdminAdminListBodySkeleton />;
}

export function SuperAdminAuditRouteSkeleton() {
  return <SuperAdminAuditBodySkeleton />;
}

export function SuperAdminSettingsRouteSkeleton() {
  return <SectionContentSkeleton rows={6} />;
}

export function SuperAdminHostShellRouteSkeleton() {
  return <HostOrgCardGridSkeleton />;
}

export function SuperAdminOrgShellRouteSkeleton() {
  return <SectionContentSkeleton rows={5} />;
}

export function GenericAdminRouteSkeleton() {
  return <SectionContentSkeleton rows={4} />;
}

export function GuestMarketingListRouteSkeleton() {
  return <ListingCardGridSkeleton count={6} hideStats label="Loading listings" />;
}

export function GuestDevelopmentDetailRouteSkeleton() {
  return <DevelopmentDetailPageSkeleton />;
}

export function GuestPropertyDetailRouteSkeleton() {
  return <DevelopmentDetailPageSkeleton />;
}

export function GuestSearchRouteSkeleton() {
  return <BookingsCardGridSkeleton />;
}

export function GuestAccountRouteSkeleton() {
  return <GuestAccountGateSkeleton />;
}

export function GuestChatRouteSkeleton() {
  return <PropertyChatPageSkeleton />;
}

export function GuestCalendarRouteSkeleton() {
  return <BookingsCalendarSkeleton gridOnly />;
}

export function GuestFormRouteSkeleton() {
  return <GuestFormPageSkeleton />;
}
