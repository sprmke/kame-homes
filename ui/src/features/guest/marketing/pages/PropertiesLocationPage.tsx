import { useMemo, useRef, useState } from 'react';

import { Navigate, useParams } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import {
  PropertiesFilters,
  PropertiesHero,
  PropertiesMap,
  PropertiesToolbar,
  PropertyCard,
  PropertyListItem,
  type ViewMode,
} from '@/features/guest/marketing/properties/components';
import {
  usePrefetchPublicProperties,
  usePublicProperties,
} from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import { placeLabelFromPropertyLocation } from '@/features/guest/marketing/properties/lib/groupPropertiesByLocation';
import {
  clearPropertyFilters,
  countActivePropertyFilters,
  EMPTY_PROPERTIES_FACETS,
  parsePropertiesQuery,
  toPropertyCard,
  writePropertiesQuery,
  type PropertiesListingQuery,
  type PropertiesSort,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { ListingFilteredEmpty } from '@/features/guest/marketing/shared/components/ListingFilteredEmpty';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import { ListingResultsPagination } from '@/features/guest/marketing/shared/components/ListingResultsPagination';
import { useListingUrlQuery } from '@/features/guest/marketing/shared/hooks/useListingUrlQuery';
import { humanizeLocationSlug } from '@/features/guest/marketing/shared/lib/locationSlug';

import {
  ListingGridSkeleton,
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

export function PropertiesLocationPage() {
  const { location = '' } = useParams<{ location: string }>();
  const locationSlug = location.trim().toLowerCase();
  const reduceMotion = useReducedMotion();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const {
    query: listingQuery,
    setFilters,
    patchQuery,
    goToPage,
    viewParam,
    setViewParam,
  } = useListingUrlQuery<PropertiesListingQuery>({
    parse: parsePropertiesQuery,
    write: writePropertiesQuery,
    scope: { locationSlug },
    unscope: { locationSlug: '' },
  });
  const prefetchPage = usePrefetchPublicProperties();
  const viewMode = parseViewMode(viewParam);
  const hasFilters = countActivePropertyFilters(listingQuery) > 0;

  const { data, isLoading, isError, isFetching, refetch } = usePublicProperties(
    listingQuery,
    Boolean(locationSlug)
  );

  const properties = useMemo(() => (data?.data ?? []).map(toPropertyCard), [data?.data]);
  const place =
    properties[0] != null
      ? placeLabelFromPropertyLocation(properties[0].location)
      : locationSlug
        ? locationSlug
            .split('-')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
        : null;
  const totalResults = data?.total ?? 0;
  usePageTitle(publicPageTitle(`Homes in ${place ?? humanizeLocationSlug(locationSlug)}`));
  usePageMeta({
    description: `Homes for rent in ${place ?? humanizeLocationSlug(locationSlug)}. Compare prices, check dates, and book online.`,
    canonicalPath: `/properties/in/${locationSlug}`,
  });

  if (!locationSlug) {
    return <Navigate to="/properties" replace />;
  }

  // Unknown place (nothing listed there at all) → back to the index. With filters
  // applied, an empty result shows the filtered-empty state instead.
  if (!isLoading && !isError && totalResults === 0 && !hasFilters) {
    return <Navigate to="/properties" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <PropertiesHero />

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

      <div className="flex min-w-0">
        <PropertiesFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          isMobile={false}
          value={listingQuery}
          onChange={setFilters}
          facets={data?.facets ?? EMPTY_PROPERTIES_FACETS}
        />

        <PropertiesFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile={true}
          value={listingQuery}
          onChange={setFilters}
          facets={data?.facets ?? EMPTY_PROPERTIES_FACETS}
        />

        <main
          ref={resultsRef}
          className="min-w-0 flex-1 scroll-mt-36 overflow-x-hidden lg:scroll-mt-16"
        >
          <PropertiesToolbar
            viewMode={viewMode}
            onViewModeChange={(mode) => setViewParam(mode === 'grid' ? null : mode)}
            sortBy={listingQuery.sort}
            onSortChange={(next) => patchQuery({ sort: next as PropertiesSort })}
            totalResults={totalResults}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          <h1 className="text-foreground px-4 pt-4 text-lg font-semibold tracking-tight sm:px-6 sm:pt-5 sm:text-xl">
            Homes in {place}
          </h1>

          {isError ? (
            <ListingLoadError noun="homes" onRetry={() => void refetch()} retrying={isFetching} />
          ) : isLoading ? (
            <div className="min-w-0 p-4 sm:p-6">
              {viewMode === 'map' ? (
                <ListingMapSkeleton />
              ) : viewMode === 'list' ? (
                <ListingRowSkeleton maxWidthClassName="max-w-4xl" />
              ) : (
                <ListingGridSkeleton
                  columnsClassName="grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  imageAspectClassName="aspect-[4/3]"
                />
              )}
            </div>
          ) : properties.length === 0 ? (
            <ListingFilteredEmpty
              noun="homes"
              onClearFilters={() => setFilters(clearPropertyFilters(listingQuery))}
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
                  <PropertiesMap properties={properties} />
                </motion.div>
              ) : (
                <motion.div
                  key={`${locationSlug}-${viewMode}-${listingQuery.page}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: isFetching ? 0.7 : 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  className="min-w-0 space-y-6 p-4 sm:p-6"
                >
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {properties.map((property, index) => (
                        <PropertyCard key={property.id} property={property} index={index} />
                      ))}
                    </div>
                  ) : (
                    <div className="mx-auto max-w-4xl space-y-4">
                      {properties.map((property, index) => (
                        <PropertyListItem key={property.id} property={property} index={index} />
                      ))}
                    </div>
                  )}
                  <ListingResultsPagination
                    onPrefetchPage={(page) => prefetchPage({ ...listingQuery, page })}
                    page={data?.page ?? listingQuery.page}
                    total={totalResults}
                    pageSize={data?.pageSize ?? listingQuery.pageSize}
                    disabled={isFetching}
                    onPageChange={goToPage}
                    scrollTargetRef={resultsRef}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
