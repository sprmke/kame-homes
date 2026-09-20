import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { SlidersHorizontal } from 'lucide-react';

import { DevelopmentsFilters } from '@/features/guest/marketing/developments/components/DevelopmentsFilters';
import { ParkingFilters } from '@/features/guest/marketing/developments/components/ParkingFilters';
import { usePublicDevelopments } from '@/features/guest/marketing/developments/hooks/usePublicDevelopments';
import { EMPTY_DEVELOPMENTS_FACETS } from '@/features/guest/marketing/developments/lib/developmentsQuery';
import type { DevelopmentsListingQuery } from '@/features/guest/marketing/developments/lib/developmentsQuery';
import type { PublicDevelopmentListItem } from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { useCaptureParkingLinkStay } from '@/features/guest/marketing/parkings/hooks/useCaptureParkingLinkStay';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  EMPTY_PARKINGS_FACETS,
  parkingsQueryToFilterState,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import {
  filterStateToParkingsQuery,
  type PublicParkingListItem,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import type { ParkingsListingQuery } from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { PropertiesFilters } from '@/features/guest/marketing/properties/components/PropertiesFilters';
import { usePublicProperties } from '@/features/guest/marketing/properties/hooks/usePublicProperties';
import { EMPTY_PROPERTIES_FACETS } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import type { PropertiesListingQuery } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import type { PublicPropertyListItem } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import {
  parseBboxFromSearchParams,
  type MapBbox,
} from '@/features/guest/marketing/shared/lib/listingMapMarkers';
import { SearchEmptyState } from '@/features/guest/search/components/SearchEmptyState';
import { SearchErrorState } from '@/features/guest/search/components/SearchErrorState';
import { SearchResultsGrid } from '@/features/guest/search/components/SearchResultsGrid';
import { SearchResultsHeader } from '@/features/guest/search/components/SearchResultsHeader';
import { SearchResultsPagination } from '@/features/guest/search/components/SearchResultsPagination';
import { SearchResultsSkeleton } from '@/features/guest/search/components/SearchResultsSkeleton';
import {
  categoriesWithResults,
  SearchResultsTabs,
} from '@/features/guest/search/components/SearchResultsTabs';
import {
  defaultSortForCategory,
  SearchResultsToolbar,
  type SearchViewMode,
} from '@/features/guest/search/components/SearchResultsToolbar';
import { SearchStatusBanner } from '@/features/guest/search/components/SearchStatusBanner';
import { useSearchListings } from '@/features/guest/search/hooks/useSearchListings';
import { requestGuestGeolocation } from '@/features/guest/search/lib/geolocation';
import {
  developmentsQueryFromSearch,
  parkingsQueryFromSearch,
  propertiesQueryFromSearch,
  shouldUsePublicListForSearchCategory,
  writeDevelopmentsFiltersToSearch,
  writeParkingsFiltersToSearch,
  writePropertiesFiltersToSearch,
} from '@/features/guest/search/lib/searchFilterParams';
import { nearbyDisplayLabel } from '@/features/guest/search/lib/searchIntents';
import { parseSearchParams, writeSearchParams } from '@/features/guest/search/lib/searchParams';
import type {
  DevelopmentSearchSummary,
  ParkingSearchSummary,
  PropertySearchSummary,
  SearchListingsType,
} from '@/features/guest/search/types/search';

import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { captureAppEvent } from '@/lib/posthog/capture';

type CategoryId = Exclude<SearchListingsType, 'all'>;

const CATEGORY_NOUN: Record<CategoryId, string> = {
  properties: 'properties',
  developments: 'developments',
  parkings: 'parkings',
};

function activeTotal(
  type: SearchListingsType,
  totals: { all: number; properties: number; developments: number; parkings: number }
): number {
  if (type === 'all') return totals.all;
  return totals[type];
}

function resolveEffectiveType(
  requested: SearchListingsType,
  totals: { all: number; properties: number; developments: number; parkings: number }
): SearchListingsType {
  const populated = categoriesWithResults(totals);
  // An explicitly scoped search stays in that category even when it is empty.
  // Nearby properties in Cebu should be an empty Properties result—not silently
  // rewritten to All, which loses the guest's stated criterion.
  if (populated.length === 0) return requested;
  if (populated.length === 1) return populated[0]!;
  if (requested === 'all') return 'all';
  if (totals[requested] > 0) return requested;
  return 'all';
}

/** Prefer focus, else the densest populated category for filter chrome. */
function preferredFilterCategory(
  totals: { properties: number; developments: number; parkings: number },
  focus: CategoryId | null
): CategoryId {
  if (focus && totals[focus] > 0) return focus;
  const order: CategoryId[] = ['properties', 'developments', 'parkings'];
  let best: CategoryId = 'properties';
  let bestN = -1;
  for (const id of order) {
    if (totals[id] > bestN) {
      bestN = totals[id];
      best = id;
    }
  }
  return best;
}

function toPropertySummary(item: PublicPropertyListItem): PropertySearchSummary {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    type: item.type,
    city: null,
    locationLabel: item.location,
    residenceName: item.developmentName ?? null,
    coverImage: item.images[0] ?? null,
    images: item.images,
    maxGuests: item.guests,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    price: item.price,
    rating: item.rating,
    reviewCount: item.reviews,
    amenities: item.amenities,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}

function toDevelopmentSummary(item: PublicDevelopmentListItem): DevelopmentSearchSummary {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    type: item.type,
    city: item.city || null,
    location: item.location || null,
    locationLabel: item.location || item.city || 'Philippines',
    coverImage: item.coverImage || null,
    images: item.images,
    developerName: item.developerName || null,
    priceRangeMin: item.priceRange.min,
    priceRangeMax: item.priceRange.max,
    propertyCount: item.propertyCount,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}

function toParkingSummary(item: PublicParkingListItem): ParkingSearchSummary {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    city: item.city ?? null,
    locationLabel: item.city || item.residenceName || 'Philippines',
    residenceName: item.residenceName ?? null,
    tower: item.tower ?? null,
    level: item.level ?? null,
    slotLabel: item.slotLabel,
    parkingType: item.parkingType,
    coverImage: item.coverImage ?? null,
    images: item.coverImage ? [item.coverImage] : [],
    ratePerNight: item.ratePerNight,
    features: item.features,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}

export function SearchResultsPage() {
  usePageTitle(publicPageTitle('Search'));
  useCaptureParkingLinkStay();
  const [searchParams, setSearchParams] = useSearchParams();
  const [locationRequesting, setLocationRequesting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<SearchViewMode>('grid');

  const query = useMemo(() => parseSearchParams(searchParams), [searchParams]);

  /**
   * Always fetch the All-scoped result set for tab counts + All view.
   * Category `type` in the URL used to zero sibling totals and hide the pill strip
   * when Filters opened a family — keep tabs driven by this overview instead.
   */
  const overviewQuery = useMemo(
    (): typeof query => ({
      where: query.where,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      adults: query.adults,
      children: query.children,
      infants: query.infants,
      pets: query.pets,
      type: 'all',
      page: 1,
      pageSize: query.pageSize,
      lat: query.lat,
      lng: query.lng,
      focus: null,
    }),
    [
      query.where,
      query.checkIn,
      query.checkOut,
      query.adults,
      query.children,
      query.infants,
      query.pets,
      query.pageSize,
      query.lat,
      query.lng,
    ]
  );
  const overviewSearch = useSearchListings(overviewQuery);
  const searchTrackedRef = useRef('');

  useEffect(() => {
    if (!overviewSearch.isFetched || overviewSearch.isFetching) return;
    const trackKey = JSON.stringify({
      where: query.where,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      type: query.type,
    });
    if (searchTrackedRef.current === trackKey) return;
    searchTrackedRef.current = trackKey;
    captureAppEvent('search_performed', {
      query_len: query.where.trim().length,
      result_count: overviewSearch.data?.totals.all ?? 0,
      has_dates: Boolean(query.checkIn && query.checkOut),
      category: query.type,
    });
  }, [
    overviewSearch.isFetched,
    overviewSearch.isFetching,
    overviewSearch.data?.totals.all,
    query.where,
    query.checkIn,
    query.checkOut,
    query.type,
  ]);

  const propertiesListQuery = useMemo(
    () => propertiesQueryFromSearch(searchParams, query),
    [searchParams, query]
  );
  const developmentsListQuery = useMemo(
    () => developmentsQueryFromSearch(searchParams, query),
    [searchParams, query]
  );
  const parkingsListQuery = useMemo(
    () => parkingsQueryFromSearch(searchParams, query),
    [searchParams, query]
  );

  const searchData = overviewSearch.data;
  const searchTotals = useMemo(
    () => searchData?.totals ?? { properties: 0, developments: 0, parkings: 0, all: 0 },
    [searchData]
  );
  const meta = searchData?.meta;
  const effectiveType = searchData ? resolveEffectiveType(query.type, searchTotals) : query.type;

  const mapBbox = useMemo(() => parseBboxFromSearchParams(searchParams), [searchParams]);
  const mapBboxActive = mapBbox != null;

  const useFilteredProperties =
    effectiveType === 'properties' &&
    (shouldUsePublicListForSearchCategory('properties', query) || mapBboxActive);
  const useFilteredDevelopments =
    effectiveType === 'developments' &&
    (shouldUsePublicListForSearchCategory('developments', query) || mapBboxActive);
  const useFilteredParkings =
    effectiveType === 'parkings' &&
    (shouldUsePublicListForSearchCategory('parkings', query) || mapBboxActive);

  const needsScopedListings =
    effectiveType !== 'all' &&
    !useFilteredProperties &&
    !useFilteredDevelopments &&
    !useFilteredParkings;

  const scopedQuery = useMemo(
    (): typeof query => ({
      ...query,
      type: effectiveType === 'all' ? query.type : effectiveType,
    }),
    [query, effectiveType]
  );
  const scopedSearch = useSearchListings(scopedQuery, needsScopedListings);

  const propertiesList = usePublicProperties(propertiesListQuery, useFilteredProperties);
  const developmentsList = usePublicDevelopments(developmentsListQuery, useFilteredDevelopments);
  const parkingsList = usePublicParkings(parkingsListQuery, useFilteredParkings);

  const scopedData = scopedSearch.data;

  const properties = useMemo(
    () =>
      useFilteredProperties
        ? (propertiesList.data?.data ?? []).map(toPropertySummary)
        : effectiveType === 'properties'
          ? (scopedData?.properties ?? [])
          : (searchData?.properties ?? []),
    [useFilteredProperties, propertiesList.data?.data, effectiveType, scopedData, searchData]
  );
  const developments = useMemo(
    () =>
      useFilteredDevelopments
        ? (developmentsList.data?.data ?? []).map(toDevelopmentSummary)
        : effectiveType === 'developments'
          ? (scopedData?.developments ?? [])
          : (searchData?.developments ?? []),
    [useFilteredDevelopments, developmentsList.data?.data, effectiveType, scopedData, searchData]
  );
  const parkings = useMemo(
    () =>
      useFilteredParkings
        ? (parkingsList.data?.data ?? []).map(toParkingSummary)
        : effectiveType === 'parkings'
          ? (scopedData?.parkings ?? [])
          : (searchData?.parkings ?? []),
    [useFilteredParkings, parkingsList.data?.data, effectiveType, scopedData, searchData]
  );

  const totals = useMemo(() => {
    if (useFilteredProperties) {
      const n = propertiesList.data?.total ?? 0;
      return { ...searchTotals, properties: n, all: n };
    }
    if (useFilteredDevelopments) {
      const n = developmentsList.data?.total ?? 0;
      return { ...searchTotals, developments: n, all: n };
    }
    if (useFilteredParkings) {
      const n = parkingsList.data?.total ?? 0;
      return { ...searchTotals, parkings: n, all: n };
    }
    if (needsScopedListings && scopedData) {
      const n = activeTotal(effectiveType, scopedData.totals);
      if (effectiveType === 'properties') {
        return { ...searchTotals, properties: n, all: n };
      }
      if (effectiveType === 'developments') {
        return { ...searchTotals, developments: n, all: n };
      }
      if (effectiveType === 'parkings') {
        return { ...searchTotals, parkings: n, all: n };
      }
    }
    return searchTotals;
  }, [
    useFilteredProperties,
    useFilteredDevelopments,
    useFilteredParkings,
    needsScopedListings,
    propertiesList.data?.total,
    developmentsList.data?.total,
    parkingsList.data?.total,
    scopedData,
    effectiveType,
    searchTotals,
  ]);

  const needsLocation = Boolean(meta?.needsLocation);

  const currentSort =
    effectiveType === 'properties'
      ? propertiesListQuery.sort
      : effectiveType === 'developments'
        ? developmentsListQuery.sort
        : effectiveType === 'parkings'
          ? parkingsListQuery.sort
          : defaultSortForCategory('all');

  const toolbarTotal = effectiveType === 'all' ? totals.all : activeTotal(effectiveType, totals);

  const patchQuery = (patch: Partial<typeof query>, options?: { replace?: boolean }) => {
    const next = writeSearchParams({ ...query, ...patch }, searchParams);
    setSearchParams(next, { replace: options?.replace ?? true });
  };

  useEffect(() => {
    // Never canonicalize the URL from TanStack's previous-query placeholder.
    // Its totals belong to a different phrase/location and can momentarily send
    // a Nearby category to the wrong tab while the real request is in flight.
    if (!searchData || overviewSearch.isLoading || overviewSearch.isPlaceholderData) return;
    if (effectiveType === query.type) return;
    const next = writeSearchParams({ ...query, type: effectiveType, page: 1 }, searchParams);
    setSearchParams(next, { replace: true });
  }, [
    searchData,
    overviewSearch.isLoading,
    overviewSearch.isPlaceholderData,
    effectiveType,
    query,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (viewMode === 'map' && effectiveType === 'all') {
      setViewMode('grid');
    }
  }, [effectiveType, viewMode]);

  /** Map bounds live in the URL so the viewport is shareable and back-navigable. */
  const applyMapViewport = useCallback(
    (bbox: MapBbox) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('swLat', String(bbox.swLat));
          next.set('swLng', String(bbox.swLng));
          next.set('neLat', String(bbox.neLat));
          next.set('neLng', String(bbox.neLng));
          next.set('page', '1');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const clearMapViewport = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of ['swLat', 'swLng', 'neLat', 'neLng']) next.delete(key);
        next.set('page', '1');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const requestLocation = async () => {
    setLocationRequesting(true);
    try {
      const geo = await requestGuestGeolocation();
      if (geo.ok) {
        patchQuery({ lat: geo.latitude, lng: geo.longitude, page: 1 });
      }
    } finally {
      setLocationRequesting(false);
    }
  };

  const searchNearby = async () => {
    setLocationRequesting(true);
    const focus = query.focus;
    const where = nearbyDisplayLabel(focus);
    try {
      const geo = await requestGuestGeolocation();
      if (geo.ok) {
        patchQuery(
          {
            where,
            lat: geo.latitude,
            lng: geo.longitude,
            page: 1,
            focus,
            type: focus ?? 'all',
          },
          { replace: false }
        );
        return;
      }
      patchQuery(
        { where, lat: null, lng: null, page: 1, focus, type: focus ?? 'all' },
        { replace: false }
      );
    } finally {
      setLocationRequesting(false);
    }
  };

  const categoryLoading =
    (useFilteredProperties &&
      (propertiesList.isLoading || propertiesList.isPlaceholderData) &&
      !propertiesList.isError) ||
    (useFilteredDevelopments &&
      (developmentsList.isLoading || developmentsList.isPlaceholderData) &&
      !developmentsList.isError) ||
    (useFilteredParkings &&
      (parkingsList.isLoading || parkingsList.isPlaceholderData) &&
      !parkingsList.isError) ||
    (needsScopedListings &&
      (scopedSearch.isLoading || scopedSearch.isPlaceholderData) &&
      !scopedSearch.isError &&
      !scopedData);

  const categoryError =
    (useFilteredProperties && propertiesList.isError) ||
    (useFilteredDevelopments && developmentsList.isError) ||
    (useFilteredParkings && parkingsList.isError) ||
    (needsScopedListings && scopedSearch.isError);

  const showSkeleton =
    (overviewSearch.isLoading && !searchData) ||
    overviewSearch.isPlaceholderData ||
    (effectiveType !== 'all' && categoryLoading);
  const showError = !showSkeleton && (overviewSearch.isError || categoryError);
  const showEmpty = !showSkeleton && !showError && totals.all === 0;
  const showResults = !showSkeleton && !showEmpty && !showError && totals.all > 0;
  const showPagination = showResults && effectiveType !== 'all';
  const populatedCount = categoriesWithResults(searchTotals).length;
  const showTabStrip = populatedCount >= 2;
  const showCategoryFilters = effectiveType !== 'all';

  const isFetching =
    overviewSearch.isFetching ||
    (needsScopedListings && scopedSearch.isFetching) ||
    (useFilteredProperties && propertiesList.isFetching) ||
    (useFilteredDevelopments && developmentsList.isFetching) ||
    (useFilteredParkings && parkingsList.isFetching);

  const retrySearch = () => {
    void overviewSearch.refetch();
    if (needsScopedListings) void scopedSearch.refetch();
    if (useFilteredProperties) void propertiesList.refetch();
    if (useFilteredDevelopments) void developmentsList.refetch();
    if (useFilteredParkings) void parkingsList.refetch();
  };

  const setPropertiesFilters = (next: PropertiesListingQuery) => {
    setSearchParams(
      (prev) => {
        const merged = writePropertiesFiltersToSearch(next, prev);
        return writeSearchParams({ ...query, page: 1 }, merged);
      },
      { replace: true }
    );
  };

  const setDevelopmentsFilters = (next: DevelopmentsListingQuery) => {
    setSearchParams(
      (prev) => {
        const merged = writeDevelopmentsFiltersToSearch(next, prev);
        return writeSearchParams({ ...query, page: 1 }, merged);
      },
      { replace: true }
    );
  };

  const setParkingsFilters = (next: ParkingsListingQuery) => {
    setSearchParams(
      (prev) => {
        const merged = writeParkingsFiltersToSearch(next, prev);
        return writeSearchParams({ ...query, page: 1 }, merged);
      },
      { replace: true }
    );
  };

  const patchSort = (sort: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('sort', sort);
        return writeSearchParams({ ...query, page: 1 }, next);
      },
      { replace: true }
    );
  };

  /**
   * Each category filters on its own schema, so All has no sidebar of its own.
   * The button names the category it opens and the tab strip follows, which is
   * the only announcement the switch needs.
   */
  const filtersTargetCategory =
    effectiveType === 'all' ? preferredFilterCategory(searchTotals, query.focus) : null;

  const openFilters = () => {
    if (filtersTargetCategory) {
      patchQuery({ type: filtersTargetCategory, page: 1 }, { replace: false });
      setFiltersOpen(true);
      return;
    }
    setFiltersOpen((open) => !open);
  };

  const openMobileFilters = () => {
    if (filtersTargetCategory) {
      patchQuery({ type: filtersTargetCategory, page: 1 }, { replace: false });
    }
    setMobileFiltersOpen(true);
  };

  const propertyFacets = propertiesList.data?.facets ?? EMPTY_PROPERTIES_FACETS;
  const developmentFacets = developmentsList.data?.facets ?? EMPTY_DEVELOPMENTS_FACETS;
  const parkingFacets = parkingsList.data?.facets ?? EMPTY_PARKINGS_FACETS;
  const parkingTowerOptions = parkingFacets.towers.map((t) => t.tower);

  const errorMessage =
    (overviewSearch.error as Error | null)?.message ||
    (scopedSearch.error as Error | null)?.message ||
    (propertiesList.error as Error | null)?.message ||
    (developmentsList.error as Error | null)?.message ||
    (parkingsList.error as Error | null)?.message ||
    undefined;

  /**
   * Map view keeps its own chrome and canvas mounted through every refetch. Each
   * pan writes new bounds, which makes the category query a fresh key — swapping in
   * a skeleton there would tear the map down and reset the viewport mid-gesture.
   */
  const isMapView = viewMode === 'map' && effectiveType !== 'all' && !showError;
  const chromeVisible = showResults || isMapView;

  return (
    <div className="bg-background min-h-screen">
      <SearchResultsHeader />

      {chromeVisible ? (
        <div className="border-border bg-background/95 sticky top-16 z-30 border-b p-4 backdrop-blur-sm lg:hidden">
          <Button
            variant="outline"
            onClick={openMobileFilters}
            className="min-h-[44px] w-full gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {filtersTargetCategory
              ? `Filter ${CATEGORY_NOUN[filtersTargetCategory]}`
              : 'Filters & Sort'}
          </Button>
        </div>
      ) : null}

      <div className="flex min-w-0">
        {showCategoryFilters && effectiveType === 'properties' ? (
          <>
            <PropertiesFilters
              isOpen={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              isMobile={false}
              value={propertiesListQuery}
              onChange={setPropertiesFilters}
              facets={propertyFacets}
            />
            <PropertiesFilters
              isOpen={mobileFiltersOpen}
              onClose={() => setMobileFiltersOpen(false)}
              isMobile
              value={propertiesListQuery}
              onChange={setPropertiesFilters}
              facets={propertyFacets}
            />
          </>
        ) : null}

        {showCategoryFilters && effectiveType === 'developments' ? (
          <>
            <DevelopmentsFilters
              isOpen={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              isMobile={false}
              value={developmentsListQuery}
              onChange={setDevelopmentsFilters}
              facets={developmentFacets}
            />
            <DevelopmentsFilters
              isOpen={mobileFiltersOpen}
              onClose={() => setMobileFiltersOpen(false)}
              isMobile
              value={developmentsListQuery}
              onChange={setDevelopmentsFilters}
              facets={developmentFacets}
            />
          </>
        ) : null}

        {showCategoryFilters && effectiveType === 'parkings' ? (
          <>
            <ParkingFilters
              isOpen={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              isMobile={false}
              filters={parkingsQueryToFilterState(parkingsListQuery)}
              onFiltersChange={(filters) =>
                setParkingsFilters(filterStateToParkingsQuery(filters, parkingsListQuery))
              }
              towerOptions={parkingTowerOptions}
            />
            <ParkingFilters
              isOpen={mobileFiltersOpen}
              onClose={() => setMobileFiltersOpen(false)}
              isMobile
              filters={parkingsQueryToFilterState(parkingsListQuery)}
              onFiltersChange={(filters) =>
                setParkingsFilters(filterStateToParkingsQuery(filters, parkingsListQuery))
              }
              towerOptions={parkingTowerOptions}
            />
          </>
        ) : null}

        <main className="min-w-0 flex-1 overflow-x-hidden">
          {chromeVisible ? (
            <SearchResultsToolbar
              category={effectiveType === 'all' ? 'all' : effectiveType}
              totalResults={toolbarTotal}
              sortBy={currentSort}
              onSortChange={patchSort}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              filtersOpen={filtersOpen && showCategoryFilters}
              onToggleFilters={openFilters}
              filtersCategoryLabel={
                filtersTargetCategory ? CATEGORY_NOUN[filtersTargetCategory] : null
              }
            />
          ) : null}

          <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
            {showTabStrip ? (
              <div className="border-border mb-6 border-b pb-4">
                <SearchResultsTabs
                  active={effectiveType}
                  totals={searchTotals}
                  focus={query.focus}
                  onChange={(type) => patchQuery({ type, page: 1 }, { replace: false })}
                />
              </div>
            ) : null}

            {showResults || showEmpty || isMapView ? (
              <SearchStatusBanner
                focus={query.focus}
                type={effectiveType}
                meta={meta}
                onClearFocus={() => patchQuery({ focus: null }, { replace: false })}
              />
            ) : null}

            {showError ? (
              <SearchErrorState
                message={errorMessage}
                onRetry={retrySearch}
                retrying={isFetching}
              />
            ) : null}

            {showSkeleton && !isMapView ? (
              <SearchResultsSkeleton viewMode={viewMode} category={effectiveType} />
            ) : null}

            {showEmpty && !isMapView ? (
              <SearchEmptyState
                where={query.where}
                needsLocation={needsLocation}
                onRequestLocation={needsLocation ? () => void requestLocation() : undefined}
                locationRequesting={locationRequesting}
                smartFallbackLabel={
                  meta?.usedSmartFallback ? (meta.intentLabel ?? meta.conceptId) : null
                }
                onSearchNearby={needsLocation ? undefined : () => void searchNearby()}
                onClearWhere={
                  query.where
                    ? () =>
                        patchQuery({ where: '', lat: null, lng: null, page: 1 }, { replace: false })
                    : undefined
                }
                onClearDates={
                  !needsLocation && (query.checkIn || query.checkOut)
                    ? () => patchQuery({ checkIn: '', checkOut: '', page: 1 })
                    : undefined
                }
              />
            ) : null}

            {isMapView ? (
              <SearchResultsGrid
                type={effectiveType}
                properties={properties}
                developments={developments}
                parkings={parkings}
                totals={totals}
                viewMode="map"
                focus={query.focus}
                mapBbox={mapBbox}
                mapLoading={isFetching || showSkeleton}
                onViewportChange={applyMapViewport}
                onResetViewport={mapBboxActive ? clearMapViewport : undefined}
              />
            ) : null}

            {showResults && !isMapView ? (
              <div className={isFetching ? 'opacity-80 transition-opacity' : undefined}>
                <SearchResultsGrid
                  type={effectiveType}
                  properties={properties}
                  developments={developments}
                  parkings={parkings}
                  totals={totals}
                  viewMode={viewMode}
                  focus={query.focus}
                  onViewCategory={(type) => patchQuery({ type, page: 1 }, { replace: false })}
                />
                {showPagination ? (
                  <div className="mt-8">
                    <SearchResultsPagination
                      page={query.page}
                      pageSize={query.pageSize}
                      total={activeTotal(effectiveType, totals)}
                      onPageChange={(page) => patchQuery({ page })}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
