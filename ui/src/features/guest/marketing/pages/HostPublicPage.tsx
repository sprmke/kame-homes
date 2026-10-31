import { useEffect, useRef, useState } from 'react';

import { Navigate, useParams } from 'react-router-dom';

import { HostPublicHero } from '@/features/guest/marketing/hosts/components/HostPublicHero';
import {
  HostPublicListingsTabs,
  type HostListingTab,
} from '@/features/guest/marketing/hosts/components/HostPublicListingsTabs';
import { HostPublicParkingCard } from '@/features/guest/marketing/hosts/components/HostPublicParkingCard';
import { HostPublicPropertyCard } from '@/features/guest/marketing/hosts/components/HostPublicPropertyCard';
import { HostPublicReviews } from '@/features/guest/marketing/hosts/components/HostPublicReviews';
import { useHostListingPageSize } from '@/features/guest/marketing/hosts/hooks/useHostListingPageSize';
import { HOST_LISTING_GRID_CLASS } from '@/features/guest/marketing/hosts/lib/hostListingGrid';
import { usePublicHost } from '@/features/guest/marketing/properties/hooks/usePublicHost';
import { GuestPublicBrandShell } from '@/features/guest/marketing/shared/components/GuestPublicBrandShell';
import {
  PublicListingPagination,
  PublicListingSectionHeader,
} from '@/features/guest/marketing/shared/components/PublicListingPagination';
import { useMarketingBrandColor } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

function HostPublicPageSkeleton() {
  return (
    <div className="bg-background public-page-top min-h-screen pb-16 sm:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8 lg:gap-10">
          <div className="bg-muted h-28 w-28 shrink-0 animate-pulse rounded-full sm:h-32 sm:w-32 lg:h-36 lg:w-36" />
          <div className="w-full max-w-md space-y-3 sm:max-w-none sm:pt-2">
            <div className="bg-muted mx-auto h-8 w-48 animate-pulse rounded-lg sm:mx-0" />
            <div className="bg-muted mx-auto h-5 w-40 animate-pulse rounded sm:mx-0" />
            <div className="bg-muted mx-auto h-4 w-64 animate-pulse rounded sm:mx-0" />
            <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />
          </div>
        </div>
        <div className="border-border mt-10 border-t pt-8 sm:mt-12 sm:pt-10 lg:mt-14">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
            <div className="flex gap-2">
              <div className="bg-muted h-11 w-28 animate-pulse rounded-full" />
              <div className="bg-muted h-11 w-32 animate-pulse rounded-full" />
            </div>
            <div className="bg-muted h-11 w-[8.5rem] animate-pulse rounded-full" />
          </div>
          <div className={HOST_LISTING_GRID_CLASS}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2" aria-hidden>
                <div className="bg-muted aspect-square animate-pulse rounded-xl" />
                <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function listingCountLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function totalPagesFor(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize) || 1);
}

function defaultListingTab(homesCount: number, parkingsCount: number): HostListingTab {
  if (homesCount > 0) return 'homes';
  if (parkingsCount > 0) return 'parkings';
  return 'homes';
}

export function HostPublicPage() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { data: host, isLoading, isError } = usePublicHost(orgSlug);
  usePageTitle(publicPageTitle(host?.name ? `${host.name}` : 'Host'));
  const { setBrandColor } = useMarketingBrandColor();
  const [activeTab, setActiveTab] = useState<HostListingTab>('homes');
  const [homesPage, setHomesPage] = useState(1);
  const [parkingsPage, setParkingsPage] = useState(1);
  const listingsContainerRef = useRef<HTMLDivElement>(null);
  const listingsPanelRef = useRef<HTMLDivElement>(null);
  const pageSize = useHostListingPageSize(listingsContainerRef);

  useEffect(() => {
    setBrandColor(host?.brandColor ?? null);
    return () => setBrandColor(null);
  }, [host?.brandColor, setBrandColor]);

  useEffect(() => {
    setHomesPage(1);
    setParkingsPage(1);
    if (!host) {
      setActiveTab('homes');
      return;
    }
    setActiveTab(defaultListingTab(host.properties.length, host.parkings?.length ?? 0));
  }, [orgSlug, host]);

  useEffect(() => {
    if (!host) return;
    const homesTotal = totalPagesFor(host.properties.length, pageSize);
    const parkingsTotal = totalPagesFor(host.parkings?.length ?? 0, pageSize);
    setHomesPage((current) => Math.min(current, homesTotal));
    setParkingsPage((current) => Math.min(current, parkingsTotal));
  }, [host, pageSize]);

  const scrollListingsIntoView = () => {
    listingsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!orgSlug) {
    return <Navigate to="/properties" replace />;
  }

  if (!isLoading && (isError || !host)) {
    return <Navigate to="/properties" replace />;
  }

  if (isLoading || !host) {
    return <HostPublicPageSkeleton />;
  }

  const parkings = host.parkings ?? [];
  const homesCount = host.properties.length;
  const parkingsCount = parkings.length;
  const hasHomes = homesCount > 0;
  const hasParkings = parkingsCount > 0;
  const showTabs = hasHomes && hasParkings;

  const homesTotalPages = totalPagesFor(homesCount, pageSize);
  const parkingsTotalPages = totalPagesFor(parkingsCount, pageSize);
  const safeHomesPage = Math.min(homesPage, homesTotalPages);
  const safeParkingsPage = Math.min(parkingsPage, parkingsTotalPages);
  const homesPageItems = pageSlice(host.properties, safeHomesPage, pageSize);
  const parkingsPageItems = pageSlice(parkings, safeParkingsPage, pageSize);

  const activePage = activeTab === 'homes' ? safeHomesPage : safeParkingsPage;
  const activeTotalPages = activeTab === 'homes' ? homesTotalPages : parkingsTotalPages;
  const onActivePageChange = activeTab === 'homes' ? setHomesPage : setParkingsPage;

  return (
    <GuestPublicBrandShell brandColor={host.brandColor}>
      <div className="bg-background public-page-top min-h-screen pb-16 sm:pb-20">
        <HostPublicHero host={host} className="pt-3 sm:pt-16" />

        {hasHomes || hasParkings ? (
          <div
            ref={listingsContainerRef}
            className="mx-auto mt-5 max-w-6xl px-4 sm:mt-12 sm:px-6 lg:mt-14"
          >
            <div ref={listingsPanelRef} className="scroll-mt-24">
              {showTabs ? (
                <div
                  role="tabpanel"
                  aria-label={activeTab === 'homes' ? 'Homes' : 'Parkings'}
                  className="border-border border-t pt-4 sm:pt-10"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
                    <HostPublicListingsTabs
                      active={activeTab}
                      homesCount={homesCount}
                      parkingsCount={parkingsCount}
                      onChange={(tab) => {
                        setActiveTab(tab);
                        scrollListingsIntoView();
                      }}
                    />
                    <PublicListingPagination
                      variant="inline"
                      page={activePage}
                      totalPages={activeTotalPages}
                      onPageChange={(page) => {
                        onActivePageChange(page);
                        scrollListingsIntoView();
                      }}
                    />
                  </div>

                  <div className={HOST_LISTING_GRID_CLASS}>
                    {activeTab === 'homes'
                      ? homesPageItems.map((property, index) => (
                          <HostPublicPropertyCard
                            key={property.slug}
                            property={property}
                            index={index}
                          />
                        ))
                      : parkingsPageItems.map((parking, index) => (
                          <HostPublicParkingCard
                            key={parking.slug}
                            parking={parking}
                            index={index}
                          />
                        ))}
                  </div>
                </div>
              ) : (
                <>
                  <PublicListingSectionHeader
                    title={listingCountLabel(
                      hasHomes ? homesCount : parkingsCount,
                      hasHomes ? 'home' : 'parking',
                      hasHomes ? 'homes' : 'parkings'
                    )}
                    page={hasHomes ? safeHomesPage : safeParkingsPage}
                    totalPages={hasHomes ? homesTotalPages : parkingsTotalPages}
                    onPageChange={(page) => {
                      if (hasHomes) setHomesPage(page);
                      else setParkingsPage(page);
                      scrollListingsIntoView();
                    }}
                  />
                  <div className={HOST_LISTING_GRID_CLASS}>
                    {hasHomes
                      ? homesPageItems.map((property, index) => (
                          <HostPublicPropertyCard
                            key={property.slug}
                            property={property}
                            index={index}
                          />
                        ))
                      : parkingsPageItems.map((parking, index) => (
                          <HostPublicParkingCard
                            key={parking.slug}
                            parking={parking}
                            index={index}
                          />
                        ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        <HostPublicReviews host={host} />
      </div>
    </GuestPublicBrandShell>
  );
}
