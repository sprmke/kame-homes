import { useMemo } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { DevelopmentCard } from '@/features/guest/marketing/developments/components/DevelopmentCard';
import { ParkingSlotCard } from '@/features/guest/marketing/developments/components/ParkingSlotCard';
import { PropertyCard } from '@/features/guest/marketing/properties/components/PropertyCard';
import { PropertyListItem } from '@/features/guest/marketing/properties/components/PropertyListItem';
import { LazyListingMapView as ListingMapView } from '@/features/guest/marketing/shared/components/LazyListingMapView';
import {
  markersFromCoords,
  type ListingMapMarker,
  type MapBbox,
} from '@/features/guest/marketing/shared/lib/listingMapMarkers';
import { orderListingCategories } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import { resolveListingImages } from '@/features/guest/marketing/shared/lib/mockListingImages';
import type { SearchViewMode } from '@/features/guest/search/components/SearchResultsToolbar';
import {
  mapDevelopmentSummaryToCard,
  mapParkingSummaryToSlot,
  mapPropertySummaryToCard,
} from '@/features/guest/search/lib/mapSearchSummaries';
import type {
  DevelopmentSearchSummary,
  ParkingSearchSummary,
  PropertySearchSummary,
  SearchListingsTotals,
  SearchListingsType,
} from '@/features/guest/search/types/search';

type CategoryId = Exclude<SearchListingsType, 'all'>;

type Props = {
  type: SearchListingsType;
  properties: PropertySearchSummary[];
  developments: DevelopmentSearchSummary[];
  parkings: ParkingSearchSummary[];
  totals: SearchListingsTotals;
  viewMode?: SearchViewMode;
  /** Origin page category — preferred section renders first on All. */
  focus?: CategoryId | null;
  onViewCategory?: (type: CategoryId) => void;
  /** Map bounds currently applied from the URL. */
  mapBbox?: MapBbox | null;
  mapLoading?: boolean;
  onViewportChange?: (bbox: MapBbox) => void;
  onResetViewport?: () => void;
};

function CategoryHeading({
  label,
  count,
  showSeeAll,
  onSeeAll,
}: {
  label: string;
  count: number;
  showSeeAll: boolean;
  onSeeAll?: () => void;
}) {
  return (
    <div className="mb-4 flex min-h-[44px] items-center justify-between gap-3">
      <h2 className="text-foreground text-base font-semibold">
        {label}
        <span className="text-muted-foreground ml-2 text-sm font-medium tabular-nums">{count}</span>
      </h2>
      {showSeeAll && onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="text-primary hover:text-primary/80 min-h-[44px] shrink-0 cursor-pointer text-sm font-semibold underline-offset-4 hover:underline"
        >
          See all
        </button>
      ) : null}
    </div>
  );
}

const DEFAULT_CATEGORY_ORDER: CategoryId[] = ['properties', 'developments', 'parkings'];

function gridClass(viewMode: SearchViewMode): string {
  if (viewMode === 'list') {
    return 'mx-auto max-w-3xl space-y-4';
  }
  return 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
}

function propertyMarkers(properties: PropertySearchSummary[]): ListingMapMarker[] {
  return markersFromCoords(properties, (row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.locationLabel || row.city || 'Philippines',
    latitude: row.latitude,
    longitude: row.longitude,
    price: row.price,
    rating: row.rating,
    images: resolveListingImages(
      row.images.length > 0 ? row.images : row.coverImage ? [row.coverImage] : [],
      'property',
      row.slug
    ),
    href: `/properties/${row.slug}`,
    family: 'property',
  }));
}

function developmentMarkers(developments: DevelopmentSearchSummary[]): ListingMapMarker[] {
  return markersFromCoords(developments, (row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.locationLabel || row.location || row.city || 'Philippines',
    latitude: row.latitude,
    longitude: row.longitude,
    price: row.priceRangeMin,
    images: resolveListingImages(
      row.images.length > 0 ? row.images : row.coverImage ? [row.coverImage] : [],
      'development',
      row.slug
    ),
    href: `/developments/${row.slug}`,
    family: 'development',
  }));
}

function parkingMarkers(parkings: ParkingSearchSummary[]): ListingMapMarker[] {
  return markersFromCoords(parkings, (row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.locationLabel || row.city || 'Philippines',
    latitude: row.latitude,
    longitude: row.longitude,
    price: row.ratePerNight,
    images: resolveListingImages(
      row.images.length > 0 ? row.images : row.coverImage ? [row.coverImage] : [],
      'parking',
      row.slug
    ),
    href: `/parkings/${row.slug}`,
    family: 'parking',
  }));
}

const CATEGORY_NOUNS: Record<CategoryId, { singular: string; plural: string }> = {
  properties: { singular: 'property', plural: 'properties' },
  developments: { singular: 'development', plural: 'developments' },
  parkings: { singular: 'parking', plural: 'parkings' },
};

/**
 * Own component so the marker memo survives the parent's refetch renders — the map
 * keeps its instance and viewport instead of remounting on every bounds change.
 */
function SearchResultsMap({
  type,
  properties,
  developments,
  parkings,
  totals,
  mapBbox,
  mapLoading,
  onViewportChange,
  onResetViewport,
}: Props & { type: CategoryId }) {
  const markers = useMemo(() => {
    if (type === 'properties') return propertyMarkers(properties);
    if (type === 'developments') return developmentMarkers(developments);
    return parkingMarkers(parkings);
  }, [type, properties, developments, parkings]);

  const noun = CATEGORY_NOUNS[type];

  return (
    <ListingMapView
      markers={markers}
      totalInView={totals[type]}
      nounSingular={noun.singular}
      nounPlural={noun.plural}
      initialBbox={mapBbox ?? null}
      loading={mapLoading}
      onViewportChange={onViewportChange}
      onResetViewport={onResetViewport}
    />
  );
}

export function SearchResultsGrid(props: Props) {
  const {
    type,
    properties,
    developments,
    parkings,
    totals,
    viewMode = 'grid',
    focus = null,
    onViewCategory,
  } = props;
  const reduceMotion = useReducedMotion();
  const isAll = type === 'all';
  const categoryOrder = orderListingCategories(focus, DEFAULT_CATEGORY_ORDER);

  if (viewMode === 'map' && type !== 'all') {
    return <SearchResultsMap {...props} type={type} />;
  }

  const effectiveView: SearchViewMode = viewMode === 'map' ? 'grid' : viewMode;

  const visible: CategoryId[] = categoryOrder.filter((id) => {
    if (id === 'properties') return (isAll || type === 'properties') && properties.length > 0;
    if (id === 'developments') return (isAll || type === 'developments') && developments.length > 0;
    return (isAll || type === 'parkings') && parkings.length > 0;
  });

  let index = 0;
  const layoutClass = gridClass(effectiveView);

  return (
    <div className="space-y-10">
      {visible.map((category) => {
        if (category === 'properties') {
          return (
            <section key="properties" aria-label="Properties">
              <CategoryHeading
                label="Properties"
                count={totals.properties}
                showSeeAll={isAll && totals.properties > properties.length}
                onSeeAll={() => onViewCategory?.('properties')}
              />
              <div className={layoutClass}>
                {properties.map((item) => {
                  const card = mapPropertySummaryToCard(item);
                  const i = index++;
                  return effectiveView === 'list' ? (
                    <PropertyListItem key={item.id} property={card} index={i} />
                  ) : (
                    <motion.div
                      key={item.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.03 }}
                    >
                      <PropertyCard property={card} index={i} />
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        }

        if (category === 'developments') {
          return (
            <section key="developments" aria-label="Developments">
              <CategoryHeading
                label="Developments"
                count={totals.developments}
                showSeeAll={isAll && totals.developments > developments.length}
                onSeeAll={() => onViewCategory?.('developments')}
              />
              <div className={layoutClass}>
                {developments.map((item) => {
                  const card = mapDevelopmentSummaryToCard(item);
                  const i = index++;
                  return (
                    <motion.div
                      key={item.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.03 }}
                    >
                      <DevelopmentCard development={card} index={i} />
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        }

        return (
          <section key="parkings" aria-label="Parkings">
            <CategoryHeading
              label="Parkings"
              count={totals.parkings}
              showSeeAll={isAll && totals.parkings > parkings.length}
              onSeeAll={() => onViewCategory?.('parkings')}
            />
            <div className={layoutClass}>
              {parkings.map((item) => {
                const mapped = mapParkingSummaryToSlot(item);
                const i = index++;
                return (
                  <motion.div
                    key={item.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.03 }}
                  >
                    <ParkingSlotCard
                      slot={mapped.slot}
                      developmentSlug={mapped.developmentSlug}
                      developmentName={mapped.developmentName}
                      city={mapped.city}
                      detailSlug={mapped.detailSlug}
                      index={i}
                    />
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
