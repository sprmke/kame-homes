import { useMemo, useRef, useState } from 'react';

import { Navigate, useParams } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import { ParkingFilters, ParkingToolbar } from '@/features/guest/marketing/developments/components';
import {
  DEFAULT_PARKING_FILTERS,
  type ParkingFilterState,
  type ParkingSortKey,
} from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import { ParkingsEntriesGrid, ParkingsHero } from '@/features/guest/marketing/parkings/components';
import { useCaptureParkingLinkStay } from '@/features/guest/marketing/parkings/hooks/useCaptureParkingLinkStay';
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
import { humanizeLocationSlug } from '@/features/guest/marketing/shared/lib/locationSlug';
import { normalizeCityPlace } from '@/features/guest/marketing/shared/lib/locationSlug';

import { ListingGridSkeleton } from '@/components/skeletons/ListingGridSkeleton';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

export function ParkingsLocationPage() {
  useCaptureParkingLinkStay();
  const { location = '' } = useParams<{ location: string }>();
  const locationSlug = location.trim().toLowerCase();
  const reduceMotion = useReducedMotion();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  // Filters, sort and pagination all run server-side so every page and the total
  // reflect the active filters (not just the slots already loaded).
  const {
    query,
    setFilters: setQueryFilters,
    patchQuery,
    goToPage,
  } = useListingUrlQuery<ParkingsListingQuery>({
    parse: parseParkingsQuery,
    write: writeParkingsQuery,
    scope: { locationSlug, pageSize: 48 },
    unscope: { locationSlug: '', pageSize: DEFAULT_PARKINGS_QUERY.pageSize },
  });
  const prefetchPage = usePrefetchPublicParkings();
  const filters = useMemo(() => parkingsQueryToFilterState(query), [query]);
  const setFilters = (next: ParkingFilterState) =>
    setQueryFilters(filterStateToParkingsQuery(next, query));
  const hasFilters = countActiveParkingsQueryFilters(query) > 0;

  const { data, isLoading, isError, isFetching, refetch } = usePublicParkings(
    query,
    Boolean(locationSlug)
  );

  const entries = useMemo(() => (data?.data ?? []).map(toParkingListEntry), [data?.data]);
  const city = entries[0] != null ? normalizeCityPlace(entries[0].city) : null;
  const facets = data?.facets ?? EMPTY_PARKINGS_FACETS;
  const towerOptions = useMemo(() => facets.towers.map((entry) => entry.tower), [facets.towers]);
  const totalResults = data?.total ?? 0;
  const placeLabel = city ?? humanizeLocationSlug(locationSlug);
  usePageTitle(publicPageTitle(`Parking in ${placeLabel}`));
  usePageMeta({
    description: `Parking slots in ${placeLabel}. Pick dates and reserve by the night.`,
    canonicalPath: `/parkings/in/${locationSlug}`,
  });

  if (!locationSlug) {
    return <Navigate to="/parkings" replace />;
  }

  // Unknown place (nothing listed there at all) → back to the index. With filters
  // applied, an empty result shows the filtered-empty state instead.
  if (!isLoading && !isError && totalResults === 0 && !hasFilters) {
    return <Navigate to="/parkings" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <ParkingsHero />

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
          isMobile={false}
          filters={filters}
          onFiltersChange={setFilters}
          towerOptions={towerOptions}
        />

        <ParkingFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile={true}
          filters={filters}
          onFiltersChange={setFilters}
          towerOptions={towerOptions}
          sortBy={query.sort}
          onSortChange={(sort) => patchQuery({ sort: sort as ParkingSortKey })}
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

          <h1 className="text-foreground px-4 pt-4 text-lg font-semibold tracking-tight sm:px-6 sm:pt-5 sm:text-xl">
            Parking in {city ?? '…'}
          </h1>

          {isError ? (
            <ListingLoadError noun="parking" onRetry={() => void refetch()} retrying={isFetching} />
          ) : isLoading ? (
            <div className="min-w-0 p-4 sm:p-6">
              <ListingGridSkeleton
                columnsClassName="grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                imageAspectClassName="aspect-square"
              />
            </div>
          ) : entries.length === 0 ? (
            <ListingFilteredEmpty
              noun="slots"
              onClearFilters={() => setFilters(DEFAULT_PARKING_FILTERS)}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${locationSlug}-${query.page}`}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: isFetching ? 0.7 : 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                className="min-w-0 space-y-6 p-4 sm:p-6"
              >
                <ParkingsEntriesGrid entries={entries} />
                <ListingResultsPagination
                  onPrefetchPage={(page) => prefetchPage({ ...query, page })}
                  page={data?.page ?? query.page}
                  total={totalResults}
                  pageSize={data?.pageSize ?? query.pageSize}
                  disabled={isFetching}
                  onPageChange={goToPage}
                  scrollTargetRef={resultsRef}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
