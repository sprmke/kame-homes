import { useMemo, useRef, useState } from 'react';

import { Navigate, useParams } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import {
  DevelopmentsFilters,
  DevelopmentsGrid,
  DevelopmentsHero,
  DevelopmentsToolbar,
  type DevelopmentViewMode,
} from '@/features/guest/marketing/developments/components';
import {
  usePrefetchPublicDevelopments,
  usePublicDevelopments,
} from '@/features/guest/marketing/developments/hooks/usePublicDevelopments';
import {
  clearDevelopmentFilters,
  countActiveDevelopmentFilters,
  DEFAULT_DEVELOPMENTS_QUERY,
  EMPTY_DEVELOPMENTS_FACETS,
  parseDevelopmentsQuery,
  toDevelopmentCard,
  writeDevelopmentsQuery,
  type DevelopmentsListingQuery,
  type DevelopmentsSort,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { PropertiesByDevelopment } from '@/features/guest/marketing/properties/components/PropertiesByDevelopment';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import {
  DEFAULT_PROPERTIES_QUERY,
  toPropertyCard,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { ListingFilteredEmpty } from '@/features/guest/marketing/shared/components/ListingFilteredEmpty';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';
import { ListingResultsPagination } from '@/features/guest/marketing/shared/components/ListingResultsPagination';
import { useListingUrlQuery } from '@/features/guest/marketing/shared/hooks/useListingUrlQuery';
import { humanizeLocationSlug } from '@/features/guest/marketing/shared/lib/locationSlug';
import { normalizeCityPlace } from '@/features/guest/marketing/shared/lib/locationSlug';

import {
  ListingLocationRowsSkeleton,
  ListingRowSkeleton,
} from '@/components/skeletons/ListingGridSkeleton';
import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { usePageMeta } from '@/lib/seo/usePageMeta';

/** Development rows per page — each row is a carousel of that development's homes. */
const DEVELOPMENTS_PER_PAGE = 12;
/** Preview homes fetched for the developments on the current page (API max). */
const PREVIEW_PROPERTIES_LIMIT = 48;

function parseViewMode(raw: string | null): DevelopmentViewMode {
  return raw === 'list' ? 'list' : 'grid';
}

export function DevelopmentsLocationPage() {
  const { location = '' } = useParams<{ location: string }>();
  const locationSlug = location.trim().toLowerCase();
  const reduceMotion = useReducedMotion();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  const { query, setFilters, patchQuery, goToPage, viewParam, setViewParam } =
    useListingUrlQuery<DevelopmentsListingQuery>({
      parse: parseDevelopmentsQuery,
      write: writeDevelopmentsQuery,
      scope: { locationSlug, pageSize: DEVELOPMENTS_PER_PAGE },
      unscope: { locationSlug: '', pageSize: DEFAULT_DEVELOPMENTS_QUERY.pageSize },
    });
  const prefetchPage = usePrefetchPublicDevelopments();
  const viewMode = parseViewMode(viewParam);
  const hasFilters = countActiveDevelopmentFilters(query) > 0;

  // Filters, sort and pagination run server-side on developments.
  const developmentsResult = usePublicDevelopments(query, Boolean(locationSlug));
  const developments = useMemo(
    () => (developmentsResult.data?.data ?? []).map(toDevelopmentCard),
    [developmentsResult.data?.data]
  );

  // Row previews: one call scoped to the developments on this page.
  const pageDevelopmentSlugs = useMemo(
    () => developments.map((development) => development.slug).sort(),
    [developments]
  );
  const propertiesResult = usePublicProperties(
    {
      ...DEFAULT_PROPERTIES_QUERY,
      development: pageDevelopmentSlugs,
      page: 1,
      pageSize: PREVIEW_PROPERTIES_LIMIT,
    },
    viewMode === 'grid' && pageDevelopmentSlugs.length > 0
  );
  const properties = useMemo(
    () => (propertiesResult.data?.data ?? []).map(toPropertyCard),
    [propertiesResult.data?.data]
  );

  const city = developments[0] != null ? normalizeCityPlace(developments[0].city) : null;
  const totalDevelopments = developmentsResult.data?.total ?? 0;
  const placeLabel = city ?? humanizeLocationSlug(locationSlug);
  usePageTitle(publicPageTitle(`Developments in ${placeLabel}`));
  usePageMeta({
    description: `Residential developments in ${placeLabel}, with the homes available in each.`,
    canonicalPath: `/developments/in/${locationSlug}`,
  });
  const isLoading =
    developmentsResult.isLoading || (viewMode === 'grid' && propertiesResult.isLoading);
  const isError = developmentsResult.isError || propertiesResult.isError;
  const isFetching = developmentsResult.isFetching || propertiesResult.isFetching;

  if (!locationSlug) {
    return <Navigate to="/developments" replace />;
  }

  // Unknown place (nothing listed there at all) → back to the index. With filters
  // applied, an empty result shows the filtered-empty state instead.
  if (!developmentsResult.isLoading && !isError && totalDevelopments === 0 && !hasFilters) {
    return <Navigate to="/developments" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <DevelopmentsHero />

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
        <DevelopmentsFilters
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          isMobile={false}
          value={query}
          onChange={setFilters}
          facets={developmentsResult.data?.facets ?? EMPTY_DEVELOPMENTS_FACETS}
        />

        <DevelopmentsFilters
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          isMobile={true}
          value={query}
          onChange={setFilters}
          facets={developmentsResult.data?.facets ?? EMPTY_DEVELOPMENTS_FACETS}
          sortBy={query.sort}
          onSortChange={(next) => patchQuery({ sort: next as DevelopmentsSort })}
        />

        <main
          ref={resultsRef}
          className="min-w-0 flex-1 scroll-mt-36 overflow-x-hidden lg:scroll-mt-16"
        >
          <DevelopmentsToolbar
            viewMode={viewMode}
            onViewModeChange={(mode) => setViewParam(mode === 'list' ? 'list' : null)}
            sortBy={query.sort}
            onSortChange={(next) => patchQuery({ sort: next as DevelopmentsSort })}
            totalResults={totalDevelopments}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          <h1 className="text-foreground px-4 pt-4 text-lg font-semibold tracking-tight sm:px-6 sm:pt-5 sm:text-xl">
            Developments in {city ?? '…'}
          </h1>

          {isError ? (
            <ListingLoadError
              noun="developments"
              retrying={isFetching}
              onRetry={() => {
                void developmentsResult.refetch();
                void propertiesResult.refetch();
              }}
            />
          ) : isLoading ? (
            <div className="min-w-0 p-4 sm:p-6">
              {viewMode === 'list' ? (
                <ListingRowSkeleton maxWidthClassName="max-w-4xl" />
              ) : (
                <ListingLocationRowsSkeleton />
              )}
            </div>
          ) : developments.length === 0 ? (
            <ListingFilteredEmpty
              noun="developments"
              onClearFilters={() => setFilters(clearDevelopmentFilters(query))}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${locationSlug}-${viewMode}-${query.page}`}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: isFetching ? 0.7 : 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                className="min-w-0 p-4 sm:p-6"
              >
                {viewMode === 'grid' ? (
                  <PropertiesByDevelopment developments={developments} properties={properties} />
                ) : (
                  <DevelopmentsGrid developments={developments} viewMode="list" />
                )}
                <ListingResultsPagination
                  onPrefetchPage={(page) => prefetchPage({ ...query, page })}
                  page={developmentsResult.data?.page ?? query.page}
                  total={totalDevelopments}
                  pageSize={developmentsResult.data?.pageSize ?? query.pageSize}
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
