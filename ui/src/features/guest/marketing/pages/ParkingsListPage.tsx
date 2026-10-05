import { useCallback, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import { ParkingFilters, ParkingToolbar } from '@/features/guest/marketing/developments/components';
import type { ParkingSortKey } from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import { DEFAULT_PARKING_FILTERS } from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import { ParkingsByLocation, ParkingsHero } from '@/features/guest/marketing/parkings/components';
import { useCaptureParkingLinkStay } from '@/features/guest/marketing/parkings/hooks/useCaptureParkingLinkStay';
import {
  usePrefetchPublicParkings,
  usePublicParkings,
} from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  EMPTY_PARKINGS_FACETS,
  filterStateToParkingsQuery,
  parseParkingsQuery,
  parkingsQueryToFilterState,
  toParkingListEntry,
  writeParkingsQuery,
  type ParkingsListingQuery,
  type PublicParkingListItem,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { ListingActiveFilterChips } from '@/features/guest/marketing/shared/components/ListingActiveFilterChips';
import { ListingFilteredEmpty } from '@/features/guest/marketing/shared/components/ListingFilteredEmpty';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import { ListingResultsPagination } from '@/features/guest/marketing/shared/components/ListingResultsPagination';
import { usePublicPlaceGroups } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';
import {
  buildParkingFilterChips,
  removeParkingFilterChip,
} from '@/features/guest/marketing/shared/lib/listingFilterChips';

import { ListingLocationRowsSkeleton } from '@/components/skeletons/ListingGridSkeleton';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

function isDefaultGroupedBrowse(query: ParkingsListingQuery): boolean {
  return (
    !query.where &&
    !query.locationSlug &&
    query.locations.length === 0 &&
    !query.motorcycle &&
    query.towers.length === 0 &&
    query.minPrice == null &&
    query.maxPrice == null &&
    !query.checkIn &&
    !query.checkOut &&
    query.lat == null &&
    query.lng == null &&
    query.swLat == null &&
    query.swLng == null &&
    query.neLat == null &&
    query.neLng == null &&
    query.sort === 'tower' &&
    query.page === 1
  );
}

export function ParkingsListPage() {
  usePageTitle(publicPageTitle('Parkings'));
  usePageMeta({
    canonicalPath: '/parkings',
    description: 'Find and reserve parking by the night near condos and developments.',
  });
  useCaptureParkingLinkStay();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseParkingsQuery(searchParams), [searchParams]);

  const groupedBrowse = isDefaultGroupedBrowse(query);
  const facetQuery = useMemo(
    () => (groupedBrowse ? { ...query, pageSize: 1 } : query),
    [groupedBrowse, query]
  );
  const prefetchPage = usePrefetchPublicParkings();
  const { data, isLoading, isError, isFetching, refetch } = usePublicParkings(facetQuery);
  const resultsRef = useRef<HTMLElement>(null);
  const placeGroups = usePublicPlaceGroups<PublicParkingListItem>('parkings', groupedBrowse);
  const reduceMotion = useReducedMotion();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const patchQuery = useCallback(
    (partial: Partial<ParkingsListingQuery>) => {
      setSearchParams(
        (prev) => writeParkingsQuery({ ...parseParkingsQuery(prev), ...partial }, prev),
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Page changes push history so Back returns to the previous page.
  const goToPage = useCallback(
    (page: number) => {
      setSearchParams((prev) => writeParkingsQuery({ ...parseParkingsQuery(prev), page }, prev));
    },
    [setSearchParams]
  );

  const filters = useMemo(() => parkingsQueryToFilterState(query), [query]);
  const facets = data?.facets ?? EMPTY_PARKINGS_FACETS;
  const towerOptions = useMemo(() => facets.towers.map((entry) => entry.tower), [facets.towers]);

  const setFilters = useCallback(
    (nextFilters: ReturnType<typeof parkingsQueryToFilterState>) => {
      setSearchParams(
        (prev) =>
          writeParkingsQuery(
            filterStateToParkingsQuery(nextFilters, parseParkingsQuery(prev)),
            prev
          ),
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const entries = useMemo(() => (data?.data ?? []).map(toParkingListEntry), [data?.data]);
  const parkingLocationGroups = useMemo(
    () =>
      (placeGroups.data?.pages ?? []).flatMap((page) =>
        page.groups.map((group) => ({
          city: group.place,
          locationSlug: group.locationSlug,
          title: group.title,
          entries: group.preview.map(toParkingListEntry),
        }))
      ),
    [placeGroups.data?.pages]
  );
  const totalResults = data?.total ?? 0;
  const filterChips = useMemo(() => buildParkingFilterChips(filters), [filters]);
  const hasActiveFilters = filterChips.length > 0;

  return (
    <div className="bg-background min-h-screen">
      <ParkingsHero />

      <div className="border-border bg-background/95 sticky top-16 z-30 border-b p-4 backdrop-blur-sm lg:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileFiltersOpen(true)}
          className="min-h-[44px] w-full gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters & Sort
        </Button>
      </div>

      <div className="flex min-w-0">
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
          sortBy={query.sort}
          onSortChange={(sort) => patchQuery({ sort: sort as ParkingSortKey, page: 1 })}
        />

        <main
          ref={resultsRef}
          className="min-w-0 flex-1 scroll-mt-36 overflow-x-hidden lg:scroll-mt-16"
        >
          <ParkingToolbar
            sortBy={query.sort}
            onSortChange={(sort) => patchQuery({ sort: sort as ParkingSortKey, page: 1 })}
            totalResults={totalResults}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          {hasActiveFilters ? (
            <div className="border-border border-b px-4 py-3 sm:px-6">
              <ListingActiveFilterChips
                chips={filterChips}
                onRemove={(id) => setFilters(removeParkingFilterChip(filters, id))}
                onClearAll={() => setFilters(DEFAULT_PARKING_FILTERS)}
              />
            </div>
          ) : null}

          {isError ? (
            <ListingLoadError
              noun="parking slots"
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          ) : isLoading && !data ? (
            <div className="min-w-0 p-4 sm:p-6">
              <ListingLocationRowsSkeleton />
            </div>
          ) : entries.length === 0 ? (
            <ListingFilteredEmpty
              noun="slots"
              onClearFilters={() => setFilters(DEFAULT_PARKING_FILTERS)}
              onOpenFilters={() => {
                if (
                  typeof window !== 'undefined' &&
                  window.matchMedia('(max-width: 1023px)').matches
                ) {
                  setMobileFiltersOpen(true);
                } else {
                  setFiltersOpen(true);
                }
              }}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`parkings-${totalResults}-${query.sort}`}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: isFetching ? 0.7 : 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                className="min-w-0 p-4 sm:p-6"
              >
                {groupedBrowse && placeGroups.isLoading ? (
                  <div role="status" aria-live="polite">
                    <ListingLocationRowsSkeleton sectionCount={2} />
                  </div>
                ) : groupedBrowse && placeGroups.isError && parkingLocationGroups.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16" role="alert">
                    <p className="text-muted-foreground text-sm">Could not load places.</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => void placeGroups.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <ParkingsByLocation
                    entries={groupedBrowse ? [] : entries}
                    groups={groupedBrowse ? parkingLocationGroups : undefined}
                    hasMore={groupedBrowse && Boolean(placeGroups.hasNextPage)}
                    isLoadingMore={placeGroups.isFetchingNextPage}
                    hasLoadMoreError={
                      groupedBrowse && placeGroups.isError && parkingLocationGroups.length > 0
                    }
                    onLoadMore={
                      groupedBrowse && parkingLocationGroups.length > 0
                        ? () => void placeGroups.fetchNextPage()
                        : undefined
                    }
                  />
                )}
                {groupedBrowse ? null : (
                  <ListingResultsPagination
                    onPrefetchPage={(page) => prefetchPage({ ...facetQuery, page })}
                    page={data?.page ?? query.page}
                    total={totalResults}
                    pageSize={data?.pageSize ?? query.pageSize}
                    disabled={isFetching}
                    onPageChange={goToPage}
                    scrollTargetRef={resultsRef}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
