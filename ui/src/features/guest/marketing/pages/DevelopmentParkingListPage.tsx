import { useCallback, useMemo, useRef, useState } from 'react';

import { Navigate, Link, useParams } from 'react-router-dom';

import { AnimatePresence, motion } from 'framer-motion';
import { Home, SlidersHorizontal } from 'lucide-react';

import {
  ParkingFilters,
  ParkingHero,
  ParkingSlotsGrid,
  ParkingToolbar,
} from '@/features/guest/marketing/developments/components';
import { usePublicDevelopment } from '@/features/guest/marketing/developments/hooks/usePublicDevelopment';
import {
  DEFAULT_PARKING_FILTERS,
  type ParkingFilterState,
  type ParkingSortKey,
} from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import type { HeroSearchValues } from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import {
  usePrefetchPublicParkings,
  usePublicParkings,
} from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  countActiveParkingsQueryFilters,
  DEFAULT_PARKINGS_QUERY,
  EMPTY_PARKINGS_FACETS,
  filterStateToParkingsQuery,
  parkingsQueryToFilterState,
  parseParkingsQuery,
  toParkingListEntry,
  writeParkingsQuery,
  type ParkingsListingQuery,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { ListingFilteredEmpty } from '@/features/guest/marketing/shared/components/ListingFilteredEmpty';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import { ListingResultsPagination } from '@/features/guest/marketing/shared/components/ListingResultsPagination';
import { useListingUrlQuery } from '@/features/guest/marketing/shared/hooks/useListingUrlQuery';

import { PublicListingBrowseSkeleton } from '@/components/skeletons/GuestMarketingSkeleton';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

export function DevelopmentParkingListPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const developmentResult = usePublicDevelopment(slug);
  const { data: development, isLoading, isError } = developmentResult;
  const resultsRef = useRef<HTMLElement>(null);

  // Filters, dates, sort and pagination run server-side (availability included), so
  // every page and the total reflect the active filters.
  const developmentSlug = slug.trim().toLowerCase();
  const {
    query,
    setFilters: setQueryFilters,
    patchQuery,
    goToPage,
  } = useListingUrlQuery<ParkingsListingQuery>({
    parse: parseParkingsQuery,
    write: writeParkingsQuery,
    scope: { developmentSlug, pageSize: 48 },
    unscope: { developmentSlug: '', pageSize: DEFAULT_PARKINGS_QUERY.pageSize },
  });
  const prefetchPage = usePrefetchPublicParkings();
  const parkingsResult = usePublicParkings(query, Boolean(developmentSlug));

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filters = useMemo(() => parkingsQueryToFilterState(query), [query]);
  const setFilters = (next: ParkingFilterState) =>
    setQueryFilters(filterStateToParkingsQuery(next, query));
  const hasFilters = countActiveParkingsQueryFilters(query) > 0;

  const handleSearch = useCallback(
    (values: HeroSearchValues) => {
      patchQuery({ checkIn: values.checkIn || '', checkOut: values.checkOut || '' });
    },
    [patchQuery]
  );

  const entries = useMemo(
    () => (parkingsResult.data?.data ?? []).map(toParkingListEntry),
    [parkingsResult.data?.data]
  );
  const facets = parkingsResult.data?.facets ?? EMPTY_PARKINGS_FACETS;
  const towerOptions = useMemo(() => facets.towers.map((entry) => entry.tower), [facets.towers]);
  const totalResults = parkingsResult.data?.total ?? 0;
  usePageTitle(publicPageTitle(development?.name ? `Parking in ${development.name}` : 'Parking'));
  usePageMeta(
    {
      description: development
        ? `Parking slots in ${development.name}. Reserve by the night.`
        : null,
      canonicalPath: `/developments/${slug}/parking`,
    },
    Boolean(development)
  );

  if (isLoading || parkingsResult.isLoading) {
    return <PublicListingBrowseSkeleton />;
  }

  if (isError) {
    return (
      <ListingLoadError
        noun="this development"
        retrying={developmentResult.isFetching}
        onRetry={() => void developmentResult.refetch()}
      />
    );
  }

  if (!development) {
    return <Navigate to="/developments" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <ParkingHero
        onSearch={handleSearch}
        redirectTo={`/developments/${development.slug}/parking`}
      />

      <div className="border-border bg-background/95 sticky top-16 z-30 border-b p-4 backdrop-blur-sm lg:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileFiltersOpen(true)}
          className="min-h-[44px] w-full gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters & Sort
        </Button>
      </div>

      <div className="flex">
        <ParkingFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          onFiltersChange={setFilters}
          towerOptions={towerOptions}
        />

        <ParkingFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile
          filters={filters}
          onFiltersChange={setFilters}
          towerOptions={towerOptions}
        />

        <main
          ref={resultsRef}
          className="min-w-0 flex-1 scroll-mt-36 overflow-x-hidden lg:scroll-mt-16"
        >
          <ParkingToolbar
            sortBy={query.sort}
            onSortChange={(sort) => patchQuery({ sort: sort as ParkingSortKey })}
            totalResults={totalResults}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
            <h1 className="text-foreground min-w-0 text-lg font-semibold tracking-tight sm:text-xl">
              Parking in {development.name}
            </h1>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-border hover:bg-muted min-h-[44px] shrink-0 gap-1.5 rounded-xl sm:gap-2"
            >
              <Link to={`/developments/${development.slug}/properties`}>
                <Home className="h-4 w-4" aria-hidden />
                View Homes
              </Link>
            </Button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${slug}-${query.page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-w-0 p-4 sm:p-6"
            >
              {parkingsResult.isError ? (
                <ListingLoadError
                  noun="parking"
                  retrying={parkingsResult.isFetching}
                  onRetry={() => void parkingsResult.refetch()}
                />
              ) : entries.length === 0 && hasFilters ? (
                <ListingFilteredEmpty
                  noun="slots"
                  onClearFilters={() => setFilters(DEFAULT_PARKING_FILTERS)}
                />
              ) : entries.length === 0 ? (
                <p className="text-muted-foreground py-24 text-center">
                  No parking listed here yet.
                </p>
              ) : (
                <ParkingSlotsGrid entries={entries} />
              )}
              <ListingResultsPagination
                onPrefetchPage={(page) => prefetchPage({ ...query, page })}
                page={parkingsResult.data?.page ?? query.page}
                total={totalResults}
                pageSize={parkingsResult.data?.pageSize ?? query.pageSize}
                disabled={parkingsResult.isFetching}
                onPageChange={goToPage}
                scrollTargetRef={resultsRef}
              />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
