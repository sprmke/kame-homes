import { useCallback, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import {
  DevelopmentsHero,
  DevelopmentsFilters,
  DevelopmentsToolbar,
  DevelopmentsGrid,
  DevelopmentsByLocation,
  DevelopmentsMap,
  type DevelopmentViewMode,
} from '@/features/guest/marketing/developments/components';
import {
  usePrefetchPublicDevelopments,
  usePublicDevelopments,
} from '@/features/guest/marketing/developments/hooks/usePublicDevelopments';
import {
  clearDevelopmentFilters,
  EMPTY_DEVELOPMENTS_FACETS,
  parseDevelopmentsQuery,
  toDevelopmentCard,
  writeDevelopmentsQuery,
  type DevelopmentsListingQuery,
  type DevelopmentsSort,
  type PublicDevelopmentListItem,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { ListingActiveFilterChips } from '@/features/guest/marketing/shared/components/ListingActiveFilterChips';
import { ListingFilteredEmpty } from '@/features/guest/marketing/shared/components/ListingFilteredEmpty';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import { ListingResultsPagination } from '@/features/guest/marketing/shared/components/ListingResultsPagination';
import { usePublicPlaceGroups } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';
import {
  buildDevelopmentFilterChips,
  removeDevelopmentFilterChip,
} from '@/features/guest/marketing/shared/lib/listingFilterChips';
import {
  parseBboxFromSearchParams,
  type MapBbox,
} from '@/features/guest/marketing/shared/lib/listingMapMarkers';

import {
  ListingCardListSkeleton,
  ListingLocationRowsSkeleton,
  ListingMapSkeleton,
} from '@/components/skeletons/ListingGridSkeleton';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

function parseViewMode(raw: string | null): DevelopmentViewMode {
  if (raw === 'list' || raw === 'map') return raw;
  return 'grid';
}

function isDefaultGroupedBrowse(
  query: DevelopmentsListingQuery,
  viewMode: DevelopmentViewMode
): boolean {
  return (
    viewMode === 'grid' &&
    !query.where &&
    !query.locationSlug &&
    query.type.length === 0 &&
    query.city.length === 0 &&
    query.minPrice == null &&
    query.maxPrice == null &&
    query.developer.length === 0 &&
    query.lat == null &&
    query.lng == null &&
    query.swLat == null &&
    query.swLng == null &&
    query.neLat == null &&
    query.neLng == null &&
    query.sort === 'recommended' &&
    query.page === 1
  );
}

export function DevelopmentsListPage() {
  usePageTitle(publicPageTitle('Developments'));
  usePageMeta({
    canonicalPath: '/developments',
    description: 'Explore residential developments and the homes and parking available in each.',
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseDevelopmentsQuery(searchParams), [searchParams]);
  const viewMode = parseViewMode(searchParams.get('view'));
  const groupedBrowse = isDefaultGroupedBrowse(query, viewMode);
  const facetQuery = useMemo(
    () => (groupedBrowse ? { ...query, pageSize: 1 } : query),
    [groupedBrowse, query]
  );
  const prefetchPage = usePrefetchPublicDevelopments();
  const { data, isLoading, isError, isFetching, refetch } = usePublicDevelopments(facetQuery);
  const resultsRef = useRef<HTMLElement>(null);
  const placeGroups = usePublicPlaceGroups<PublicDevelopmentListItem>(
    'developments',
    groupedBrowse
  );
  const reduceMotion = useReducedMotion();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const patchQuery = useCallback(
    (partial: Partial<DevelopmentsListingQuery>) => {
      setSearchParams(
        (prev) => writeDevelopmentsQuery({ ...parseDevelopmentsQuery(prev), ...partial }, prev),
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setFilters = useCallback(
    (next: DevelopmentsListingQuery) => {
      setSearchParams(
        (prev) =>
          writeDevelopmentsQuery(
            {
              ...next,
              swLat: null,
              swLng: null,
              neLat: null,
              neLng: null,
              page: 1,
            },
            prev
          ),
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Page changes push history so Back returns to the previous page.
  const goToPage = useCallback(
    (page: number) => {
      setSearchParams((prev) =>
        writeDevelopmentsQuery({ ...parseDevelopmentsQuery(prev), page }, prev)
      );
    },
    [setSearchParams]
  );

  const setViewMode = useCallback(
    (mode: DevelopmentViewMode) => {
      setSearchParams(
        (prev) => {
          const next = writeDevelopmentsQuery(
            {
              ...parseDevelopmentsQuery(prev),
              ...(mode !== 'map' ? { swLat: null, swLng: null, neLat: null, neLng: null } : {}),
            },
            prev
          );
          if (mode === 'grid') next.delete('view');
          else next.set('view', mode);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const mapBbox = useMemo(() => parseBboxFromSearchParams(searchParams), [searchParams]);

  const applyMapViewport = useCallback(
    (bbox: MapBbox) => {
      patchQuery({
        swLat: bbox.swLat,
        swLng: bbox.swLng,
        neLat: bbox.neLat,
        neLng: bbox.neLng,
        page: 1,
      });
    },
    [patchQuery]
  );

  const clearMapViewport = useCallback(() => {
    patchQuery({ swLat: null, swLng: null, neLat: null, neLng: null, page: 1 });
  }, [patchQuery]);

  const developments = useMemo(() => (data?.data ?? []).map(toDevelopmentCard), [data?.data]);
  const developmentLocationGroups = useMemo(
    () =>
      (placeGroups.data?.pages ?? []).flatMap((page) =>
        page.groups.map((group) => ({
          city: group.place,
          locationSlug: group.locationSlug,
          title: group.title,
          developments: group.preview.map(toDevelopmentCard),
        }))
      ),
    [placeGroups.data?.pages]
  );
  const facets = data?.facets ?? EMPTY_DEVELOPMENTS_FACETS;
  const totalResults = data?.total ?? 0;
  const filterChips = useMemo(() => buildDevelopmentFilterChips(query, facets), [query, facets]);
  const hasActiveFilters = filterChips.length > 0;

  return (
    <div className="bg-background min-h-screen">
      <DevelopmentsHero />

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
        <DevelopmentsFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          isMobile={false}
          value={query}
          onChange={setFilters}
          facets={facets}
        />

        <DevelopmentsFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile={true}
          value={query}
          onChange={setFilters}
          facets={facets}
          sortBy={query.sort}
          onSortChange={(sort) => patchQuery({ sort: sort as DevelopmentsSort, page: 1 })}
        />

        <main
          ref={resultsRef}
          className="min-w-0 flex-1 scroll-mt-36 overflow-x-hidden lg:scroll-mt-16"
        >
          <DevelopmentsToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={query.sort}
            onSortChange={(sort) => patchQuery({ sort: sort as DevelopmentsSort, page: 1 })}
            totalResults={totalResults}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          {hasActiveFilters ? (
            <div className="border-border border-b px-4 py-3 sm:px-6">
              <ListingActiveFilterChips
                chips={filterChips}
                onRemove={(id) => setFilters(removeDevelopmentFilterChip(query, id))}
                onClearAll={() => setFilters(clearDevelopmentFilters(query))}
              />
            </div>
          ) : null}

          {isError ? (
            <ListingLoadError
              noun="developments"
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          ) : isLoading && !data ? (
            <div className="min-w-0 p-4 sm:p-6">
              {viewMode === 'map' ? (
                <ListingMapSkeleton />
              ) : viewMode === 'list' ? (
                <ListingCardListSkeleton
                  maxWidthClassName="max-w-3xl"
                  imageAspectClassName="aspect-[16/9]"
                />
              ) : (
                <ListingLocationRowsSkeleton />
              )}
            </div>
          ) : developments.length === 0 ? (
            <ListingFilteredEmpty
              noun="developments"
              onClearFilters={() => setFilters(clearDevelopmentFilters(query))}
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
              {viewMode === 'map' ? (
                <motion.div
                  key="map"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  className="min-w-0 p-4 sm:p-6"
                >
                  <DevelopmentsMap
                    developments={developments}
                    totalInView={totalResults}
                    bbox={mapBbox}
                    loading={isFetching}
                    onViewportChange={applyMapViewport}
                    onResetViewport={mapBbox ? clearMapViewport : undefined}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={viewMode}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: isFetching ? 0.7 : 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  className="min-w-0 p-4 sm:p-6"
                >
                  {viewMode === 'grid' ? (
                    groupedBrowse && placeGroups.isLoading ? (
                      <div role="status" aria-live="polite">
                        <ListingLocationRowsSkeleton sectionCount={2} />
                      </div>
                    ) : groupedBrowse &&
                      placeGroups.isError &&
                      developmentLocationGroups.length === 0 ? (
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
                      <DevelopmentsByLocation
                        developments={groupedBrowse ? [] : developments}
                        groups={groupedBrowse ? developmentLocationGroups : undefined}
                        hasMore={groupedBrowse && Boolean(placeGroups.hasNextPage)}
                        isLoadingMore={placeGroups.isFetchingNextPage}
                        hasLoadMoreError={
                          groupedBrowse &&
                          placeGroups.isError &&
                          developmentLocationGroups.length > 0
                        }
                        onLoadMore={
                          groupedBrowse && developmentLocationGroups.length > 0
                            ? () => void placeGroups.fetchNextPage()
                            : undefined
                        }
                      />
                    )
                  ) : (
                    <DevelopmentsGrid developments={developments} viewMode={viewMode} />
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
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
