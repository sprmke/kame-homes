/**
 * Eager route-chunk fallbacks. Import only lightweight skeleton markup here.
 */
import {
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
import { OrgAnalyticsSkeleton, PropertyAnalyticsSkeleton } from '@/components/skeletons/AnalyticsSkeleton';
import { BookingsStageSummarySkeleton } from '@/components/skeletons/BookingsExtrasSkeleton';
import {
  DevelopmentDetailPageSkeleton,
  GuestAccountGateSkeleton,
  PropertyChatPageSkeleton,
} from '@/components/skeletons/GuestMarketingSkeleton';
import { HelpDocumentationTopicsSkeleton } from '@/components/skeletons/HelpSupportSkeleton';
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

export function OrgDashboardRouteSkeleton() {
  return <OrgDashboardSkeleton />;
}

export function OrgBookingsRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <BookingsStageSummarySkeleton />
      <BookingsTableSkeleton />
    </div>
  );
}

export function OrgSettingsRouteSkeleton() {
  return <AppSettingsNavLayoutSkeleton />;
}

export function OrgPropertiesRouteSkeleton() {
  return <ListingCardGridSkeleton label="Loading properties" />;
}

export function OrgParkingsRouteSkeleton() {
  return <ListingCardGridSkeleton label="Loading parkings" />;
}

export function OrgTeamRouteSkeleton() {
  return <TeamPageSkeleton />;
}

export function OrgPlansRouteSkeleton() {
  return <PlansPageSkeleton />;
}

export function OrgAnalyticsRouteSkeleton() {
  return <OrgAnalyticsSkeleton />;
}

export function OrgHelpSupportRouteSkeleton() {
  return <SectionContentSkeleton rows={4} />;
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

export function PropertyAnnouncementsRouteSkeleton() {
  return <ListRowsSkeleton rows={5} label="Loading announcements" />;
}

export function PropertyHelpSupportRouteSkeleton() {
  return <SectionContentSkeleton rows={4} />;
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
