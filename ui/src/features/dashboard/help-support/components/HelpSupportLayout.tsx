import { Outlet, useLocation, useParams } from 'react-router-dom';

import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { HelpSectionIntro } from '@/features/dashboard/help-support/components/HelpSectionIntro';
import { HelpSupportModuleNav } from '@/features/dashboard/help-support/components/HelpSupportModuleNav';
import {
  helpSupportSectionFromPath,
  useHelpSupportBasePath,
} from '@/features/dashboard/help-support/lib/helpSupportPaths';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import {
  orgPageTitle,
  parkingDashboardPageTitle,
  propertyDashboardPageTitle,
  usePageTitle,
} from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

const PAGE_SUBTITLE = 'Find answers or write to our team.';

const SECTION_INTRO = {
  faqs: {
    title: 'FAQs',
    description: 'Short answers to the questions hosts ask most.',
  },
  guides: {
    title: 'Guides',
    description: 'Walkthroughs for each page in the dashboard.',
  },
  tickets: {
    title: 'Tickets',
    description: 'Send a request to our team and track replies here.',
  },
} as const;

export function HelpSupportLayout() {
  const location = useLocation();
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const orgsQuery = useOrganizations();
  const basePath = useHelpSupportBasePath();
  const section = helpSupportSectionFromPath(location.pathname);
  const isTickets = section === 'tickets';

  useAdminLayoutFillMain(isTickets);

  const orgFromList = orgsQuery.data?.organizations.find((org) => org.slug === orgSlug);
  const pageTitle = orgContext
    ? propertyDashboardPageTitle(orgContext.property.name, 'Help & Support')
    : parkingContext
      ? parkingDashboardPageTitle(
          parkingContext.org.name,
          parkingContext.parking.name,
          'Help & Support'
        )
      : orgFromList
        ? orgPageTitle(orgFromList.name, 'Help & Support')
        : undefined;

  usePageTitle(pageTitle);

  return (
    <AdminMobilePage
      title="Help & Support"
      subtitle={PAGE_SUBTITLE}
      titleId="help-support-heading"
      className={isTickets ? 'flex min-h-0 flex-1 flex-col' : undefined}
    >
      <div
        className={cn(
          'flex min-w-0 flex-col gap-5 sm:gap-6',
          isTickets && 'min-h-0 flex-1 overflow-hidden'
        )}
      >
        {basePath ? (
          <div className="shrink-0">
            <HelpSupportModuleNav />
          </div>
        ) : null}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3 sm:gap-4',
            isTickets && 'min-h-0 flex-1 overflow-hidden'
          )}
        >
          <div className="shrink-0">
            <HelpSectionIntro
              title={SECTION_INTRO[section].title}
              description={SECTION_INTRO[section].description}
            />
          </div>
          <div className={cn(isTickets && 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
            <Outlet />
          </div>
        </div>
      </div>
    </AdminMobilePage>
  );
}
