/**
 * Eager route-chunk fallbacks. Import only lightweight skeleton markup here (page chrome
 * such as `AdminMobilePage` is fine: the admin shell already loads it).
 */
import type { ReactNode } from 'react';

import { useLocation, useSearchParams } from 'react-router-dom';

import { HOST_ANNOUNCEMENTS_PAGE_SUBTITLE } from '@/features/dashboard/announcements/lib/hostAnnouncementCopy';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { helpSupportSectionFromPath } from '@/features/dashboard/help-support/lib/helpSupportPaths';
import { isMarketingStudioTab } from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrgListingSkeletonView } from '@/features/dashboard/org/hooks/useOrgListingSkeletonView';
import { PLANS_PAGE_SUBTITLE } from '@/features/dashboard/plans/lib/plansPageCopy';

import { FloatingPanel, FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage, MobileBrandHero } from '@/components/mobile/MobileBrandHero';
import {
  AdminListToolbarSkeleton,
  AdminPageHeaderSkeleton,
  AppSettingsNavLayoutSkeleton,
  BookingsCalendarSkeleton,
  BookingsCardGridSkeleton,
  BookingsTableSkeleton,
  BookingDetailPageSkeleton,
  DashboardSkeleton,
  InboxPageSkeleton,
  ListingCardGridSkeleton,
  OrgDashboardSkeleton,
  PageEditorSkeleton,
  ParkingBookingDetailPageSkeleton,
  PlansPageSkeleton,
  ReviewsPageSkeleton,
  SectionContentSkeleton,
  TeamPageSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import {
  OrgAnalyticsSkeleton,
  PropertyAnalyticsSkeleton,
} from '@/components/skeletons/AnalyticsSkeleton';
import { HostAnnouncementsBodySkeleton } from '@/components/skeletons/AnnouncementsSkeleton';
import {
  BookingsKanbanSkeleton,
  BookingsStageSummarySkeleton,
} from '@/components/skeletons/BookingsExtrasSkeleton';
import {
  FinancePageBodySkeleton,
  MaintenancePageBodySkeleton,
} from '@/components/skeletons/FinancePageSkeleton';
import {
  DevelopmentDetailPageSkeleton,
  GuestAccountGateSkeleton,
  PropertyChatPageSkeleton,
  PropertyDetailPageSkeleton,
  PublicListingBrowseSkeleton,
} from '@/components/skeletons/GuestMarketingSkeleton';
import { GuestFormPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import {
  HelpDocumentationTopicsSkeleton,
  HelpSupportPageSkeleton,
} from '@/components/skeletons/HelpSupportSkeleton';
import {
  MarketingAiStudioConversationSkeleton,
  MarketingAiStudioHomeSkeleton,
  MarketingEditorSkeleton,
  MarketingLibraryBodySkeleton,
  MarketingThemesHomeSkeleton,
} from '@/components/skeletons/MarketingSkeletons';
import { NotificationsPageBodySkeleton } from '@/components/skeletons/NotificationsSkeleton';
import { OrgListingPageSkeleton } from '@/components/skeletons/OrgListingSkeleton';
import { ParkingDashboardSkeleton } from '@/components/skeletons/ParkingSkeleton';
import { PricingPageBodySkeleton } from '@/components/skeletons/PricingSkeleton';
import {
  SuperAdminAdminListBodySkeleton,
  SuperAdminAuditBodySkeleton,
  SuperAdminCardListBodySkeleton,
  SuperAdminHealthBodySkeleton,
  SuperAdminHostShellBodySkeleton,
  SuperAdminOrgHubBodySkeleton,
  SuperAdminOverviewBodySkeleton,
  SuperAdminSettingsBodySkeleton,
} from '@/components/skeletons/SuperAdminSkeletons';
import { TemplateWorkbenchSkeleton } from '@/components/skeletons/TemplateWorkbenchSkeleton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MARKETING_STUDIO_TAB_LABELS,
  MARKETING_STUDIO_TABS,
} from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';

import { SlidingTabsListSkeleton } from '@/components/skeletons/SlidingTabsListSkeleton';
import { cn } from '@/lib/utils';

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

/** Date range + Export + Add, same row as the loaded finance / maintenance header. */
function DateRangeExportAddActionsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <Skeleton className="h-11 w-full rounded-lg sm:w-44" />
      <Skeleton className="h-11 w-full rounded-lg sm:w-24" />
      <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
    </div>
  );
}

/** Date range + Import + New booking, same row as the loaded property header. */
function BookingsHeaderActionsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <Skeleton className="h-11 w-full rounded-lg sm:w-44" />
      <Skeleton className="h-11 w-full rounded-lg sm:w-24" />
      <Skeleton className="h-11 w-full rounded-lg sm:w-36" />
    </div>
  );
}

function BookingsListBodySkeleton({ view }: { view: string | null }) {
  return (
    <>
      <BookingsStageSummarySkeleton
        hideStatusFooter
        stageLabels={{
          action_required: 'Needs action',
          pending_docs: 'Pending',
          confirmed: 'Active',
          history: 'Completed',
        }}
      />
      <AdminListToolbarSkeleton sort />
      {view === 'calendar' ? (
        <FloatingPanel padding="md" className="overflow-hidden">
          <BookingsCalendarSkeleton />
        </FloatingPanel>
      ) : view === 'card' ? (
        <BookingsCardGridSkeleton />
      ) : view === 'kanban' ? (
        <BookingsKanbanSkeleton />
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
    </>
  );
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
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <DateFilterDesktopSkeleton />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
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
            <BookingsTableSkeleton showProperty />
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
      <AppSettingsNavLayoutSkeleton
        navLabels={[
          'Basic information',
          'Socials',
          'Superhost',
          'AI features',
          'Activity',
          'Danger zone',
        ]}
      />
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
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
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
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
      dense
    >
      <OrgListingPageSkeleton view={view} label="Loading parkings" kind="parkings" />
    </AdminMobilePage>
  );
}

export function OrgTeamRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Team"
      subtitle="Manage your organization's team members and permissions."
      desktopActions={<Skeleton className="h-11 w-full rounded-lg sm:w-32" />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <TeamPageSkeleton variant="org" />
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

export function OrgReviewsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Reviews"
      subtitle="Read and answer guest reviews across every listing."
      titleId="reviews-heading"
    >
      <ReviewsPageSkeleton tabs={['From guests', 'To write', 'About guests', 'By property']} />
    </AdminMobilePage>
  );
}

export function OrgAnalyticsRouteSkeleton() {
  const view = useOrgListingSkeletonView('listings');
  return (
    <AdminMobilePage
      title="Analytics"
      subtitle="Track revenue, occupancy, and bookings across every listing."
      titleId="org-analytics-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <DateFilterDesktopSkeleton />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
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
  return (
    <AdminMobilePage
      title="Dashboard"
      subtitle="Overview of your property's performance and activity."
      titleId="dashboard-heading"
      heroTrailing={<Skeleton className="size-9 shrink-0 rounded-full" />}
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <DateFilterDesktopSkeleton />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
      dense
      className="min-w-0 max-w-full"
    >
      <DashboardSkeleton />
    </AdminMobilePage>
  );
}

export function PropertyBookingsRouteSkeleton() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  return (
    <AdminMobilePage
      title="Bookings"
      subtitle="Manage and track all bookings for this property."
      titleId="bookings-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={<BookingsHeaderActionsSkeleton />}
      desktopActionsClassName="w-full sm:w-auto"
      dense
    >
      <BookingsListBodySkeleton view={view} />
    </AdminMobilePage>
  );
}

export function PropertyBookingDetailRouteSkeleton() {
  return (
    <>
      <MobileBrandHero title="Booking" flush className="md:hidden" />
      <BookingDetailPageSkeleton />
    </>
  );
}

export function PropertyNotificationsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Notifications"
      subtitle="Manage in-app notifications and Telegram alerts for this property."
      titleId="notifications-heading"
    >
      <NotificationsPageBodySkeleton
        moduleLabels={['Chat', 'Marketing', 'Staff', 'Operations', 'Finance', 'Maintenance']}
      />
    </AdminMobilePage>
  );
}

export function PropertyTemplatesRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Templates"
      subtitle="Manage your property's house rules, instructions, and email templates."
      titleId="templates-heading"
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
    >
      <TemplateWorkbenchSkeleton />
    </AdminMobilePage>
  );
}

export function PropertySettingsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Settings"
      subtitle="Profile, operations, and integrations for this listing."
      titleId="property-settings-heading"
      className="flex min-h-0 flex-1 flex-col"
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Skeleton className="hidden h-11 w-full rounded-lg sm:block sm:w-32" />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
    >
      <AppSettingsNavLayoutSkeleton
        navLabels={[
          'Basic Information',
          'Property Details',
          'Photos & Videos',
          'Amenities',
          'House Rules',
          'Guest Form',
          'Cancellation',
          'Location',
          'Socials',
          'Reviews & vouchers',
          'Payment',
          'Building Forms',
          'Email Automations',
          'Integrations',
          'Activity',
          'Danger Zone',
        ]}
      />
    </AdminMobilePage>
  );
}

export function PropertyFinanceRouteSkeleton() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const ledgerView = view === 'calendar' ? 'calendar' : view === 'card' ? 'card' : 'table';

  return (
    <AdminMobilePage
      title="Finance"
      subtitle="Track income and expenses for this property."
      titleId="finance-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={<DateRangeExportAddActionsSkeleton />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <FinancePageBodySkeleton view={ledgerView} />
    </AdminMobilePage>
  );
}

export function PropertyMaintenanceRouteSkeleton() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const ledgerView = view === 'calendar' ? 'calendar' : view === 'card' ? 'card' : 'table';

  return (
    <AdminMobilePage
      title="Maintenance"
      subtitle="Set maintenance items and reminders."
      titleId="maintenance-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={<DateRangeExportAddActionsSkeleton />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <MaintenancePageBodySkeleton view={ledgerView} />
    </AdminMobilePage>
  );
}

export function PropertyPricingRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Pricing"
      subtitle="Manage pricing and availability."
      titleId="pricing-heading"
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-36" />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
    >
      <PricingPageBodySkeleton statsCount={4} />
    </AdminMobilePage>
  );
}

export function PropertyAnalyticsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Analytics"
      subtitle="Track revenue, occupancy, and guest trends for this property."
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={<DateFilterDesktopSkeleton />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <PropertyAnalyticsSkeleton />
    </AdminMobilePage>
  );
}

function MarketingTabsSkeleton() {
  return (
    <SlidingTabsListSkeleton
      items={MARKETING_STUDIO_TABS.map((tab) => ({
        label: MARKETING_STUDIO_TAB_LABELS[tab],
      }))}
    />
  );
}

export function PropertyMarketingRouteSkeleton() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const tabParam = searchParams.get('tab');
  const tab = isMarketingStudioTab(tabParam) ? tabParam : 'generate';
  const itemOpen = searchParams.get('item') != null;
  const editorVariant = tab === 'video' ? 'video' : tab === 'calendar' ? 'calendar' : 'design';

  const showThemes = view === 'themes';
  const aiConversationOpen = itemOpen && tab === 'generate';
  const editorOpen = itemOpen && tab !== 'generate';
  const hasDock = editorOpen;
  const hideHeader = showThemes || editorOpen || aiConversationOpen;

  const body = showThemes ? (
    <MarketingThemesHomeSkeleton />
  ) : editorOpen ? (
    <MarketingEditorSkeleton variant={editorVariant} />
  ) : aiConversationOpen ? (
    <MarketingAiStudioConversationSkeleton />
  ) : tab === 'generate' ? (
    <MarketingAiStudioHomeSkeleton />
  ) : (
    <MarketingLibraryBodySkeleton
      title={tab === 'video' ? 'Your videos' : tab === 'calendar' ? 'Your calendars' : 'Your posts'}
    />
  );

  return (
    <AdminMobilePage
      title="Marketing"
      subtitle="Make posts, videos and calendars in one theme."
      titleId="marketing-heading"
    >
      <div
        className={cn(
          'border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden border max-lg:rounded-none max-lg:border-x-0 lg:rounded-xl',
          hasDock
            ? 'max-lg:h-[calc(100dvh-20rem-env(safe-area-inset-bottom,0px))]'
            : 'max-lg:h-[calc(100dvh-15.25rem-env(safe-area-inset-bottom,0px))]',
          'max-lg:min-h-[19rem] max-lg:flex-none',
          'lg:h-[calc(100vh-120px)] lg:min-h-[520px] lg:flex-none'
        )}
      >
        {hideHeader ? null : (
          <div className="border-border bg-card flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex min-w-0 max-sm:w-full lg:hidden">
              <Skeleton className="h-9 w-full rounded-lg sm:w-56" />
            </div>
            <div className="min-w-0 max-w-full shrink-0">
              <MarketingTabsSkeleton />
            </div>
            <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
              <Skeleton className="h-9 w-72 rounded-lg" />
            </div>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
      </div>
    </AdminMobilePage>
  );
}

export function PropertyTeamRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Team"
      subtitle="Manage your property's team members and permissions."
      desktopActions={<Skeleton className="h-11 w-full rounded-lg sm:w-32" />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <TeamPageSkeleton />
    </AdminMobilePage>
  );
}

export function PropertyReviewsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Reviews"
      subtitle="Read guest reviews, respond, and review guests after checkout."
      titleId="reviews-heading"
      desktopActions={<Skeleton className="h-11 w-full rounded-lg sm:w-28" />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <ReviewsPageSkeleton />
    </AdminMobilePage>
  );
}

export function PropertyInboxRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Guest Inbox"
      subtitle="View and reply to guest messages from connected channels."
      titleId="inbox-heading"
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-24" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
      className="flex min-h-0 flex-1 flex-col"
    >
      <InboxPageSkeleton />
    </AdminMobilePage>
  );
}

export function PropertyCustomPagesRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Public Pages"
      subtitle="Every guest URL for this listing."
      titleId="public-pages-heading"
      desktopActions={<Skeleton className="h-9 w-32 rounded-lg" />}
    >
      <div className="flex flex-col gap-8 sm:gap-10">
        {[
          { title: 'Design your pages', count: 3 },
          { title: 'Share links', count: 3 },
          { title: 'Booking links', count: 3 },
        ].map((section) => (
          <section key={section.title} className="space-y-3 sm:space-y-4">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">
              {section.title}
            </h2>
            <ListingCardGridSkeleton count={section.count} hideStats label="Loading pages" />
          </section>
        ))}
      </div>
    </AdminMobilePage>
  );
}

export function PropertyPageEditorRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Public Pages"
      subtitle="Every guest URL for this listing."
      titleId="public-pages-heading"
    >
      <PageEditorSkeleton />
    </AdminMobilePage>
  );
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
  const parking = useOptionalParkingContext();
  return (
    <AdminMobilePage
      title="Dashboard"
      subtitle={
        parking ? `Overview for ${parking.parking.name}.` : 'Overview for this parking slot.'
      }
      titleId="dashboard-heading"
      heroTrailing={<Skeleton className="size-9 shrink-0 rounded-full" />}
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <DateFilterDesktopSkeleton />
          <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
      dense
      className="min-w-0 max-w-full"
    >
      <ParkingDashboardSkeleton />
    </AdminMobilePage>
  );
}

export function ParkingBookingsRouteSkeleton() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  return (
    <AdminMobilePage
      title="Bookings"
      subtitle="Reservations for this parking slot."
      titleId="bookings-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-44" />
          <Skeleton className="h-11 w-full rounded-lg sm:w-36" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
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

export function ParkingBookingDetailRouteSkeleton() {
  const parking = useOptionalParkingContext();
  return (
    <AdminMobilePage
      title="Booking"
      subtitle={parking?.parking.name ?? 'Reservation details for this parking slot.'}
      titleId="parking-booking-heading"
    >
      <ParkingBookingDetailPageSkeleton />
    </AdminMobilePage>
  );
}

export function ParkingFinanceRouteSkeleton() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const ledgerView = view === 'calendar' ? 'calendar' : view === 'card' ? 'card' : 'table';

  return (
    <AdminMobilePage
      title="Finance"
      subtitle="Track income and expenses for this parking slot."
      titleId="finance-heading"
      overlap={<DateFilterOverlapSkeleton />}
      desktopActions={<DateRangeExportAddActionsSkeleton />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <FinancePageBodySkeleton view={ledgerView} />
    </AdminMobilePage>
  );
}

export function ParkingPricingRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Pricing"
      subtitle="Manage pricing and availability."
      titleId="parking-pricing-heading"
    >
      <PricingPageBodySkeleton statsCount={3} showDirectLinkCard />
    </AdminMobilePage>
  );
}

export function ParkingNotificationsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Notifications"
      subtitle="Manage in-app notifications and Telegram alerts for this parking slot."
      titleId="parking-notifications-heading"
      className="flex min-h-0 flex-1 flex-col"
    >
      <NotificationsPageBodySkeleton moduleLabels={['Chat', 'Parking', 'Finance']} />
    </AdminMobilePage>
  );
}

export function ParkingSettingsRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Settings"
      subtitle="Manage your parking slot's details, photos, and configurations."
      titleId="parking-settings-heading"
      className="flex min-h-0 flex-1 flex-col"
      desktopActions={<Skeleton className="h-11 w-full rounded-lg sm:w-32" />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <AppSettingsNavLayoutSkeleton
        navLabels={[
          'Basic Information',
          'Photos',
          'Parking Details',
          'Amenities',
          'Location',
          'Payment',
          'Email',
          'Booking Automation',
          'Integrations',
          'Activity',
          'Danger Zone',
        ]}
      />
    </AdminMobilePage>
  );
}

export function ParkingInboxRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Guest Inbox"
      subtitle="View and reply to guest messages from connected channels."
      titleId="inbox-heading"
      desktopActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-24" />
        </div>
      }
      desktopActionsClassName="w-full sm:w-auto"
      className="flex min-h-0 flex-1 flex-col"
    >
      <InboxPageSkeleton />
    </AdminMobilePage>
  );
}

export function ParkingTeamRouteSkeleton() {
  return (
    <AdminMobilePage
      title="Team"
      subtitle="Manage this parking slot's team members and permissions."
      desktopActions={<Skeleton className="h-11 w-full rounded-lg sm:w-32" />}
      desktopActionsClassName="w-full sm:w-auto"
    >
      <TeamPageSkeleton />
    </AdminMobilePage>
  );
}

/* Super-admin pages render their own `AdminPageHeader`, so route skeletons reserve the
 * header slot too (otherwise it pops in after the chunk resolves). */

function SuperAdminPageShell({
  title,
  subtitle,
  actions = 0,
  body,
}: {
  title?: string;
  subtitle?: string;
  actions?: number;
  body: ReactNode;
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeaderSkeleton title={title} subtitle={subtitle} actions={actions} />
      {body}
    </div>
  );
}

export function SuperAdminOverviewRouteSkeleton() {
  return (
    <SuperAdminPageShell
      title="Overview"
      subtitle="Platform health across organizations, billing, operations, and AI."
      actions={1}
      body={<SuperAdminOverviewBodySkeleton metricCount={12} />}
    />
  );
}

export function SuperAdminListRouteSkeleton({
  title,
  subtitle,
  withActions = 0,
  metricCount = 4,
  metricTitles,
  view = 'table',
}: {
  title?: string;
  subtitle?: string;
  withActions?: number;
  metricCount?: number;
  metricTitles?: string[];
  view?: 'table' | 'cards' | 'grouped';
} = {}) {
  return (
    <SuperAdminPageShell
      title={title}
      subtitle={subtitle}
      actions={withActions}
      body={
        <SuperAdminAdminListBodySkeleton
          metricCount={metricCount}
          metricTitles={metricTitles}
          view={view}
        />
      }
    />
  );
}

export function SuperAdminAuditRouteSkeleton() {
  return (
    <SuperAdminPageShell
      title="Audit log"
      subtitle="Every super-admin mutation: plan assigns, verification decisions, payouts, AI settings, credits."
      body={<SuperAdminAuditBodySkeleton />}
    />
  );
}

export function SuperAdminSettingsRouteSkeleton({
  title,
  subtitle,
  cards = 2,
  cardTitles,
}: {
  title?: string;
  subtitle?: string;
  cards?: number;
  cardTitles?: string[];
} = {}) {
  return (
    <SuperAdminPageShell
      title={title}
      subtitle={subtitle}
      body={<SuperAdminSettingsBodySkeleton cards={cards} titles={cardTitles} />}
    />
  );
}

/** Weekly ops report list: real title and action, five card rows. */
export function SuperAdminOpsReportsRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader
        title="Operations reports"
        actions={
          <Button type="button" variant="outline" size="sm" disabled>
            Generate now
          </Button>
        }
      />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="surface-card flex items-center gap-3 px-3 py-3 sm:px-4"
            aria-hidden
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full max-w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="size-4 shrink-0 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One ops report: real title, back link, and the four fixed severity labels. */
export function SuperAdminOpsReportDetailRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader title="Operations report" />
      <Skeleton className="h-4 w-24" />
      <div className="surface-card flex items-center gap-2 px-3 py-3 sm:px-4" aria-hidden>
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {['Critical', 'High', 'Medium', 'Low'].map((label) => (
          <div key={label} className="surface-card px-3 py-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
            <Skeleton className="mt-2 h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="surface-card space-y-2 px-3 py-3" aria-hidden>
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SuperAdminRateLimitsRouteSkeleton() {
  return (
    <SuperAdminPageShell
      title="Rate limits"
      subtitle="Who is close to or over the authenticated-wrapper limit right now, and the manual block list."
      body={<SuperAdminCardListBodySkeleton />}
    />
  );
}

export function SuperAdminHealthRouteSkeleton() {
  return (
    <SuperAdminPageShell
      title="System health"
      subtitle="Platform checks for configuration, integrations, scheduled jobs, and usage."
      actions={2}
      body={
        <div className="space-y-3 sm:space-y-4">
          <div className="flex gap-2 overflow-hidden">
            {['Overview', 'Configuration', 'Integrations', 'Jobs', 'Usage'].map((label) => (
              <span
                key={label}
                className="bg-muted text-muted-foreground inline-flex h-8 items-center rounded-full px-3 text-xs font-medium"
              >
                {label}
              </span>
            ))}
          </div>
          <SuperAdminHealthBodySkeleton />
        </div>
      }
    />
  );
}

export function SuperAdminAiRouteSkeleton() {
  return (
    <SuperAdminPageShell
      title="AI"
      subtitle="Spend, limits and controls for every organization. Changes apply within seconds."
      body={
        <div className="space-y-3 sm:space-y-4">
          <div className="flex gap-2 overflow-hidden">
            {['Usage', 'Limits', 'Profiles', 'Wallets', 'Controls'].map((label) => (
              <span
                key={label}
                className="bg-muted text-muted-foreground inline-flex h-8 items-center rounded-full px-3 text-xs font-medium"
              >
                {label}
              </span>
            ))}
          </div>
          <SuperAdminOverviewBodySkeleton metricCount={4} />
        </div>
      }
    />
  );
}

export function SuperAdminParkingPayoutsRouteSkeleton() {
  return (
    <SuperAdminPageShell
      title="Parking payouts"
      subtitle="Commission, guest rate cap, and the payout ledger."
      body={
        <div className="space-y-3 sm:space-y-4">
          <SuperAdminSettingsBodySkeleton cards={1} titles={['Commission & guest rate']} />
          <SuperAdminAdminListBodySkeleton metricCount={0} />
        </div>
      }
    />
  );
}

export function SuperAdminHostShellRouteSkeleton() {
  return <SuperAdminHostShellBodySkeleton />;
}

export function SuperAdminOrgShellRouteSkeleton() {
  return <SuperAdminOrgHubBodySkeleton />;
}

export function SuperAdminDevelopmentDetailRouteSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <span className="text-muted-foreground inline-flex h-11 items-center gap-1 text-sm font-medium">
        ‹ Developments
      </span>
      <AdminPageHeaderSkeleton compact card subtitle="Profile and media for this development." />
      <AppSettingsNavLayoutSkeleton
        navLabels={[
          'Basic Information',
          'Photos & Videos',
          'Email automations',
          'Document Requirements',
          'Unit types',
          'Pool',
          'Guest information',
          'Announcements',
          'Amenities',
          'Location',
          'Towers & Parking',
          'Danger Zone',
        ]}
      />
    </div>
  );
}

export function GenericAdminRouteSkeleton() {
  return <SectionContentSkeleton rows={4} />;
}

export function GuestMarketingListRouteSkeleton() {
  return <PublicListingBrowseSkeleton />;
}

export function GuestDevelopmentDetailRouteSkeleton() {
  return <DevelopmentDetailPageSkeleton />;
}

export function GuestPropertyDetailRouteSkeleton() {
  return <PropertyDetailPageSkeleton />;
}

export function GuestSearchRouteSkeleton() {
  return <PublicListingBrowseSkeleton />;
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
