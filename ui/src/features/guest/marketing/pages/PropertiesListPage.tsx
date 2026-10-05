import { useCallback, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import {
  PropertiesHero,
  PropertiesFilters,
  PropertiesToolbar,
  PropertiesByLocation,
  PropertyListItem,
  PropertiesMap,
  type ViewMode,
} from '@/features/guest/marketing/properties/components';
import {
  usePrefetchPublicProperties,
  usePublicProperties,
} from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import {
  clearPropertyFilters,
  EMPTY_PROPERTIES_FACETS,
  parsePropertiesQuery,
  toPropertyCard,
  writePropertiesQuery,
  type PropertiesListingQuery,
  type PropertiesSort,
  type PublicPropertyListItem,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { ListingActiveFilterChips } from '@/features/guest/marketing/shared/components/ListingActiveFilterChips';
import { ListingFilteredEmpty } from '@/features/guest/marketing/shared/components/ListingFilteredEmpty';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import { ListingResultsPagination } from '@/features/guest/marketing/shared/components/ListingResultsPagination';
import { usePublicPlaceGroups } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';
import {
  buildPropertyFilterChips,
  removePropertyFilterChip,
} from '@/features/guest/marketing/shared/lib/listingFilterChips';
import {
  parseBboxFromSearchParams,
  type MapBbox,
} from '@/features/guest/marketing/shared/lib/listingMapMarkers';

import {
  ListingLocationRowsSkeleton,
  ListingMapSkeleton,
  ListingRowSkeleton,
} from '@/components/skeletons/ListingGridSkeleton';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

function parseViewMode(raw: string | null): ViewMode {
  if (raw === 'list' || raw === 'map') return raw;
  return 'grid';
}

function isDefaultGroupedBrowse(query: PropertiesListingQuery, viewMode: ViewMode): boolean {
  return (
    viewMode === 'grid' &&
    !query.where &&
    !query.locationSlug &&
    query.type.length === 0 &&
    query.minPrice == null &&
    query.maxPrice == null &&
    query.bedrooms == null &&
    query.amenities.length === 0 &&
    query.development.length === 0 &&
    !query.checkIn &&
    !query.checkOut &&
    query.adults === 0 &&
    query.children === 0 &&
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

export function PropertiesListPage() {
  usePageTitle(publicPageTitle('Properties'));
  usePageMeta({
    canonicalPath: '/properties',
    description: 'Browse condos, houses, and villas for rent across the Philippines.',
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parsePropertiesQuery(searchParams), [searchParams]);
  const viewMode = parseViewMode(searchParams.get('view'));
  const groupedBrowse = isDefaultGroupedBrowse(query, viewMode);
  const facetQuery = useMemo(
    () => (groupedBrowse ? { ...query, pageSize: 1 } : query),
    [groupedBrowse, query]
  );
  const prefetchPage = usePrefetchPublicProperties();
  const { data, isLoading, isError, isFetching, refetch } = usePublicProperties(facetQuery);
  const resultsRef = useRef<HTMLElement>(null);
  const placeGroups = usePublicPlaceGroups<PublicPropertyListItem>('properties', groupedBrowse);
  const reduceMotion = useReducedMotion();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const patchQuery = useCallback(
    (partial: Partial<PropertiesListingQuery>) => {
      setSearchParams(
        (prev) => writePropertiesQuery({ ...parsePropertiesQuery(prev), ...partial }, prev),
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setFilters = useCallback(
    (next: PropertiesListingQuery) => {
      setSearchParams(
        (prev) =>
          writePropertiesQuery(
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
        writePropertiesQuery({ ...parsePropertiesQuery(prev), page }, prev)
      );
    },
    [setSearchParams]
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setSearchParams(
        (prev) => {
          const next = writePropertiesQuery(
            {
              ...parsePropertiesQuery(prev),
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

  const properties = useMemo(() => (data?.data ?? []).map(toPropertyCard), [data?.data]);
  const propertyLocationGroups = useMemo(
    () =>
      (placeGroups.data?.pages ?? []).flatMap((page) =>
        page.groups.map((group) => ({
          place: group.place,
          locationSlug: group.locationSlug,
          title: group.title,
          properties: group.preview.map(toPropertyCard),
        }))
      ),
    [placeGroups.data?.pages]
  );
  const facets = data?.facets ?? EMPTY_PROPERTIES_FACETS;
  const totalResults = data?.total ?? 0;
  const filterChips = useMemo(() => buildPropertyFilterChips(query, facets), [query, facets]);
  const hasActiveFilters = filterChips.length > 0;
  return (
    <div className="bg-background min-h-screen">
      <PropertiesHero />

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
        <PropertiesFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          isMobile={false}
          value={query}
          onChange={setFilters}
          facets={facets}
        />

        <PropertiesFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile={true}
          value={query}
          onChange={setFilters}
          facets={facets}
          sortBy={query.sort}
          onSortChange={(sort) => patchQuery({ sort: sort as PropertiesSort, page: 1 })}
        />

        <main
          ref={resultsRef}
          className="min-w-0 flex-1 scroll-mt-36 overflow-x-hidden lg:scroll-mt-16"
        >
          <PropertiesToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={query.sort}
            onSortChange={(sort) => patchQuery({ sort: sort as PropertiesSort, page: 1 })}
            totalResults={totalResults}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          {hasActiveFilters ? (
            <div className="border-border border-b px-4 py-3 sm:px-6">
              <ListingActiveFilterChips
                chips={filterChips}
                onRemove={(id) => setFilters(removePropertyFilterChip(query, id))}
                onClearAll={() => setFilters(clearPropertyFilters(query))}
              />
            </div>
          ) : null}

          {isError ? (
            <ListingLoadError
              noun="properties"
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          ) : isLoading && !data ? (
            <div className="min-w-0 p-4 sm:p-6">
              {viewMode === 'map' ? (
                <ListingMapSkeleton />
              ) : viewMode === 'list' ? (
                <ListingRowSkeleton maxWidthClassName="max-w-4xl" />
              ) : (
                <ListingLocationRowsSkeleton />
              )}
            </div>
          ) : properties.length === 0 ? (
            <ListingFilteredEmpty
              noun="properties"
              onClearFilters={() => setFilters(clearPropertyFilters(query))}
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
                  <PropertiesMap
                    properties={properties}
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
                      propertyLocationGroups.length === 0 ? (
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
                      <PropertiesByLocation
                        properties={groupedBrowse ? [] : properties}
                        groups={groupedBrowse ? propertyLocationGroups : undefined}
                        hasMore={groupedBrowse && Boolean(placeGroups.hasNextPage)}
                        isLoadingMore={placeGroups.isFetchingNextPage}
                        hasLoadMoreError={
                          groupedBrowse && placeGroups.isError && propertyLocationGroups.length > 0
                        }
                        onLoadMore={
                          groupedBrowse && propertyLocationGroups.length > 0
                            ? () => void placeGroups.fetchNextPage()
                            : undefined
                        }
                      />
                    )
                  ) : (
                    <div className="mx-auto max-w-4xl space-y-4">
                      {properties.map((property, index) => (
                        <PropertyListItem key={property.id} property={property} index={index} />
                      ))}
                    </div>
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
