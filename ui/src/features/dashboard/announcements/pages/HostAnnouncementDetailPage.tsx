import { useEffect, useMemo } from 'react';

import { Navigate, useParams } from 'react-router-dom';

import { HostAnnouncementsBodySkeleton } from '@/features/dashboard/announcements/components/HostAnnouncementCard';
import { HostAnnouncementDetailCard } from '@/features/dashboard/announcements/components/HostAnnouncementDetailCard';
import { HostAnnouncementStatCards } from '@/features/dashboard/announcements/components/HostAnnouncementStatCards';
import { useHostAnnouncementReadState } from '@/features/dashboard/announcements/hooks/useHostAnnouncementReadState';
import { useHostAnnouncements } from '@/features/dashboard/announcements/hooks/useHostAnnouncements';
import { HOST_ANNOUNCEMENTS_PAGE_SUBTITLE } from '@/features/dashboard/announcements/lib/hostAnnouncementCopy';
import { findHostAnnouncementById } from '@/features/dashboard/announcements/lib/hostAnnouncementDetail';
import {
  hostAnnouncementIdentityKey,
  summarizeHostAnnouncements,
} from '@/features/dashboard/announcements/lib/hostAnnouncementPresentation';
import { useHostAnnouncementsBasePath } from '@/features/dashboard/announcements/lib/hostAnnouncementsPaths';
import { HelpBackControl } from '@/features/dashboard/help-support/components/HelpBackControl';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
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

export function HostAnnouncementDetailPage() {
  const { orgSlug, announcementId } = useParams<{
    orgSlug?: string;
    announcementId?: string;
  }>();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const orgsQuery = useOrganizations();
  const basePath = useHostAnnouncementsBasePath();
  const { orgId } = useNotificationsOrgScope();
  const { announcements, isLoading, isError, refetch } = useHostAnnouncements();

  const summary = useMemo(() => summarizeHostAnnouncements(announcements), [announcements]);
  const announcement = findHostAnnouncementById(announcements, announcementId);

  const activeIdentityKeys = useMemo(
    () => announcements.map((entry) => hostAnnouncementIdentityKey(entry)),
    [announcements]
  );
  const { markRead } = useHostAnnouncementReadState(orgId, activeIdentityKeys);

  useEffect(() => {
    if (!announcement) return;
    markRead(hostAnnouncementIdentityKey(announcement));
  }, [announcement, markRead]);

  const orgFromList = orgsQuery.data?.organizations.find((org) => org.slug === orgSlug);
  const scopePageTitle = orgContext
    ? propertyDashboardPageTitle(orgContext.property.name, 'Announcements')
    : parkingContext
      ? parkingDashboardPageTitle(
          parkingContext.org.name,
          parkingContext.parking.name,
          'Announcements'
        )
      : orgFromList
        ? orgPageTitle(orgFromList.name, 'Announcements')
        : undefined;

  const scopePrefix = orgContext
    ? `${orgContext.property.name} - `
    : parkingContext
      ? `${parkingContext.parking.name} - `
      : orgFromList
        ? `${orgFromList.name} - `
        : '';

  usePageTitle(announcement ? `${scopePrefix}${announcement.title}` : scopePageTitle);

  if (!basePath) {
    return <Navigate to=".." replace />;
  }

  if (isLoading) {
    return (
      <AdminMobilePage
        title="Announcements"
        subtitle={HOST_ANNOUNCEMENTS_PAGE_SUBTITLE}
        titleId="host-announcement-detail-heading"
      >
        <HostAnnouncementsBodySkeleton detail />
      </AdminMobilePage>
    );
  }

  if (isError) {
    return (
      <AdminMobilePage
        title="Announcements"
        subtitle={HOST_ANNOUNCEMENTS_PAGE_SUBTITLE}
        titleId="host-announcement-detail-heading"
      >
        <div className="flex flex-col gap-4 sm:gap-5">
          <HelpBackControl label="Announcements" to={basePath} />
          <p className="text-destructive text-sm">Could not load announcement.</p>
          <button
            type="button"
            className="text-primary text-sm font-medium underline-offset-2 hover:underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      </AdminMobilePage>
    );
  }

  if (!announcement) {
    return <Navigate to={basePath} replace />;
  }

  return (
    <AdminMobilePage
      title="Announcements"
      subtitle={HOST_ANNOUNCEMENTS_PAGE_SUBTITLE}
      titleId="host-announcement-detail-heading"
    >
      <div className="flex flex-col gap-4 sm:gap-5">
        <HostAnnouncementStatCards summary={summary} />
        <HelpBackControl label="Announcements" to={basePath} />
        <HostAnnouncementDetailCard announcement={announcement} />
      </div>
    </AdminMobilePage>
  );
}
